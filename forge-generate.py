#!/usr/bin/env python3
"""
forge-generate.py — REAL sprite generation via ComfyUI + pixel-post-processor.

Usage:
    python forge-generate.py --sprite "Sunny Sun" --theme "summer beach comfy"
    python forge-generate.py --sprite "Watermelon Friend" --theme "summer" --frames idle,walk1,walk2,attack --workflow v6

Generates each animation frame as a separate SDXL image via ComfyUI API,
runs pixel-post-processor.py on each, and compiles a sprite sheet.
"""

import sys, os, json, time, argparse, shutil, subprocess, re
from pathlib import Path
import urllib.request
import urllib.parse

# ── CONFIG ────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent
WORKFLOW_FILES = {
    "v4": REPO_ROOT / "forge-workflow-v4.json",
    "v5": REPO_ROOT / "forge-workflow-v5-dark-fantasy.json",
    "v6": REPO_ROOT / "forge-workflow-v6-dual-lora.json",
}
POST_PROCESSOR = REPO_ROOT / "pixel-post-processor.py"
COMFY_OUTPUT = Path.home() / "Documents" / "comfy" / "ComfyUI" / "output"

# Animation frame prompts — these get appended to the base sprite prompt
ANIM_FRAMES = {
    "idle":    "standing still, facing forward, both feet on ground, relaxed pose",
    "idle2":   "slight body bounce, arms slightly swaying",
    "walk1":   "walking pose, left foot forward, right arm forward, mid-stride",
    "walk2":   "walking pose, right foot forward, left arm forward, mid-stride",
    "attack1": "attacking pose, one arm raised with weapon, dynamic motion",
    "attack2": "striking pose, body leaning forward, swinging motion",
    "hurt":    "knocked back pose, body leaning backward, stunned expression",
    "jump":    "jumping pose, both feet off ground, arms raised",
    "item":    "holding an item overhead, presenting pose, happy expression",
}

PALETTE_MAP = {
    "pico8": "pico8",
    "nes": "nes",
    "custom": "custom",
}

COMFY_API = "http://127.0.0.1:8188"


# ── HELPERS ──────────────────────────────────────────────────────────────

def log(msg):
    print(f"  🔨 {msg}", flush=True)


def ensure_comfy_running() -> bool:
    """Check if ComfyUI API is reachable. If not, try to start it."""
    try:
        req = urllib.request.Request(f"{COMFY_API}/system_stats")
        urllib.request.urlopen(req, timeout=3)
        return True
    except Exception:
        log("ComfyUI not running. Attempting to start...")
        comfy_dir = Path.home() / "Documents" / "comfy" / "ComfyUI"
        main_py = comfy_dir / "main.py"
        if not main_py.exists():
            log(f"❌ ComfyUI main.py not found at {main_py}")
            return False
        try:
            subprocess.Popen(
                [sys.executable, "-u", str(main_py), "--listen", "127.0.0.1", "--port", "8188"],
                cwd=str(comfy_dir),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            # Wait for it to be ready (up to 90s)
            for i in range(90):
                time.sleep(1)
                try:
                    req = urllib.request.Request(f"{COMFY_API}/system_stats")
                    urllib.request.urlopen(req, timeout=2)
                    log(f"ComfyUI ready after ~{i+1}s")
                    return True
                except Exception:
                    pass
            log("❌ ComfyUI failed to start within 90s")
            return False
        except Exception as e:
            log(f"❌ Failed to start ComfyUI: {e}")
            return False


def queue_workflow(workflow_json: dict, prompt_text: str, seed: int) -> str:
    """Queue a workflow via ComfyUI API. Returns the prompt_id."""
    # Replace TARGET_PROMPT
    workflow_str = json.dumps(workflow_json)
    workflow_str = workflow_str.replace("TARGET_PROMPT", prompt_text)
    workflow = json.loads(workflow_str)

    # Override seed for variety
    for node_id, node in workflow.items():
        if node.get("class_type") == "KSampler":
            node["inputs"]["seed"] = seed
            # Increase steps for quality
            node["inputs"]["steps"] = 30

    payload = {"prompt": workflow}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFY_API}/prompt",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    prompt_id = result.get("prompt_id")
    if not prompt_id:
        raise RuntimeError(f"ComfyUI returned no prompt_id: {result}")
    return prompt_id


def wait_for_completion(prompt_id: str, timeout: int = 300) -> list[dict]:
    """Wait for a ComfyUI prompt to finish. Returns list of output images."""
    history_url = f"{COMFY_API}/history/{prompt_id}"
    for _ in range(timeout):
        time.sleep(2)
        try:
            req = urllib.request.Request(history_url)
            resp = urllib.request.urlopen(req)
            history = json.loads(resp.read())
            if prompt_id in history:
                outputs = history[prompt_id].get("outputs", {})
                images = []
                for node_id, node_out in outputs.items():
                    for img in node_out.get("images", []):
                        images.append(img)
                return images
        except urllib.error.HTTPError as e:
            if e.code == 400:
                # Still running
                continue
            raise
    raise TimeoutError(f"Prompt {prompt_id} did not complete within {timeout}s")


def load_workflow(workflow_name: str) -> dict:
    """Load a forge workflow JSON by name or path."""
    if workflow_name in WORKFLOW_FILES:
        path = WORKFLOW_FILES[workflow_name]
    else:
        path = Path(workflow_name)
    if not path.exists():
        raise FileNotFoundError(f"Workflow not found: {path}")
    with open(path) as f:
        return json.load(f)


def run_post_processor(input_path: Path, output_path: Path, palette: str = "pico8", size: int = 64, grid: bool = False):
    """Run pixel-post-processor.py on a generated image."""
    if not POST_PROCESSOR.exists():
        log(f"⚠️ pixel-post-processor.py not found, skipping")
        return
    cmd = [
        sys.executable, str(POST_PROCESSOR),
        str(input_path), str(output_path),
        "--palette", palette,
        "--size", str(size),
    ]
    if grid:
        cmd.append("--split")
    log(f"Post-processing to {output_path.name}...")
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(REPO_ROOT))
    if result.returncode != 0:
        log(f"⚠️ Post-processor stderr: {result.stderr.strip()}")
    if result.stdout:
        for line in result.stdout.strip().split("\n"):
            if line.strip():
                log(line.strip())


def create_sprite_sheet(frame_dir: Path, output_path: Path, sprite_name: str):
    """Compile individual frame images into a sprite sheet."""
    try:
        from PIL import Image
    except ImportError:
        log("⚠️ PIL not available, can't compile sprite sheet")
        return None

    frames = sorted(frame_dir.glob("*.png"))
    if not frames:
        log("⚠️ No frame images found for sprite sheet")
        return None

    # All frames are same size (from post-processor)
    frame_w, frame_h = Image.open(frames[0]).size
    cols = len(frames)
    sheet = Image.new("RGBA", (frame_w * cols, frame_h))

    for i, f in enumerate(frames):
        img = Image.open(f).convert("RGBA")
        sheet.paste(img, (i * frame_w, 0))

    sheet.save(output_path)
    log(f"Sprite sheet saved: {output_path} ({cols} frames, {frame_w}x{frame_h})")
    return output_path


def create_metadata(sprite_name: str, frames: list[str], frame_dir: Path, sheet_path: Path,
                    theme: str, palette: str, size: int) -> dict:
    """Create metadata JSON for the generated sprite."""
    meta = {
        "sprite": sprite_name,
        "theme": theme,
        "palette": palette,
        "pixel_size": size,
        "sdl_size": 640,
        "animation_frames": frames,
        "frame_count": len(frames),
        "sheet_file": sheet_path.name if sheet_path else None,
        "files": [f.name for f in frame_dir.glob("*")] if frame_dir.exists() else [],
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "license": "CC0",
        "tags": [theme.lower().replace(" ", "-"), "pixel-art", "pico8", "game-ready", "sprite"],
    }
    return meta


# ── MAIN ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Forge: Generate game-ready pixel art sprites")
    parser.add_argument("--sprite", required=True, help="Sprite name (e.g. 'Sunny Sun')")
    parser.add_argument("--theme", default="fantasy", help="Theme context (e.g. 'summer beach comfy')")
    parser.add_argument("--frames", default="idle,walk1,walk2",
                        help="Animation frames to generate (comma-separated). Default: idle,walk1,walk2")
    parser.add_argument("--workflow", default="v6", choices=["v4", "v5", "v6"],
                        help="ComfyUI workflow to use")
    parser.add_argument("--output", default=None,
                        help="Output directory (default: ./forge-output/<sprite-name>)")
    parser.add_argument("--palette", default="pico8", choices=["pico8", "nes", "custom"],
                        help="Pixel art palette")
    parser.add_argument("--size", type=int, default=64, help="Target pixel art size (default: 64)")
    parser.add_argument("--no-comfy", action="store_true",
                        help="Skip ComfyUI generation (use existing images)")
    parser.add_argument("--existing-dir", default=None,
                        help="Directory with existing SDXL PNGs to post-process")
    parser.add_argument("--start-comfy", action="store_true",
                        help="Auto-start ComfyUI if not running")
    parser.add_argument("--seed", type=int, default=42, help="Base seed for generation")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be done without executing")
    args = parser.parse_args()

    sprite_slug = re.sub(r"[^a-z0-9]+", "-", args.sprite.lower()).strip("-")
    output_dir = Path(args.output) if args.output else (REPO_ROOT / "forge-output" / sprite_slug)
    frame_dir = output_dir / "frames"

    if args.dry_run:
        print(f"🎨 DRY RUN: forge-generate.py")
        print(f"   Sprite: {args.sprite}")
        print(f"   Theme: {args.theme}")
        print(f"   Frames: {args.frames}")
        print(f"   Workflow: {args.workflow}")
        print(f"   Output: {output_dir}")
        print(f"   Palette: {args.palette}, Size: {args.size}x{args.size}")
        print(f"   Seed base: {args.seed}")
        return 0

    output_dir.mkdir(parents=True, exist_ok=True)
    frame_dir.mkdir(parents=True, exist_ok=True)

    frames = [f.strip() for f in args.frames.split(",") if f.strip()]
    log(f"🎨 Forging: {args.sprite}")
    log(f"   Theme: {args.theme}")
    log(f"   Frames: {', '.join(frames)}")
    log(f"   Output: {output_dir}")

    # ── Step 1: Ensure ComfyUI is running ──
    if not args.no_comfy and not ensure_comfy_running():
        log("❌ Cannot proceed — ComfyUI is not running. Start it first or use --no-comfy with --existing-dir")
        return 1

    # ── Step 2: Load workflow ──
    if not args.no_comfy:
        workflow = load_workflow(args.workflow)
    else:
        workflow = None

    # ── Step 3: Generate each frame ──
    generated_images = []
    for i, frame_name in enumerate(frames):
        frame_prompt = ANIM_FRAMES.get(frame_name, frame_name)
        full_prompt = f"{args.sprite}, {frame_prompt}, {args.theme} theme"
        seed = args.seed + (i * 1000)  # Different seed per frame for variety

        log(f"Frame {i+1}/{len(frames)}: {frame_name}")

        if args.no_comfy and args.existing_dir:
            # Use existing images — assign them to frames in order
            existing_dir = Path(args.existing_dir)
            existing_pngs = sorted(existing_dir.glob("*.png"))
            if i < len(existing_pngs):
                src = existing_pngs[i]
                dst = frame_dir / f"{frame_name}.png"
                if src != dst:
                    shutil.copy2(str(src), str(dst))
                    log(f"  Using existing: {src.name} → {dst.name}")
                generated_images.append(dst)
            else:
                log(f"  ⚠️ Not enough existing images ({len(existing_pngs)}), need {len(frames)}")
                break
        elif not args.no_comfy:
            log(f"  Queuing ComfyUI: \"{full_prompt[:60]}...\" (seed {seed})")
            prompt_id = queue_workflow(workflow, full_prompt, seed)
            log(f"  Prompt ID: {prompt_id}")
            images = wait_for_completion(prompt_id)
            if not images:
                log(f"  ⚠️ No output images for frame {frame_name}")
                continue
            log(f"  Got {len(images)} output image(s)")

            for img_info in images:
                img_filename = img_info.get("filename")
                img_subfolder = img_info.get("subfolder", "")
                src = COMFY_OUTPUT / img_subfolder / img_filename
                dst = frame_dir / f"{frame_name}.png"
                if src.exists():
                    shutil.copy2(str(src), str(dst))
                    log(f"  ✓ Copied: {img_filename} → {dst.name}")
                    generated_images.append(dst)
                else:
                    log(f"  ⚠️ Output file not found: {src}")

    if not generated_images:
        log("❌ No images were generated!")
        return 1

    log(f"\n📸 {len(generated_images)} frame images ready in {frame_dir}")

    # ── Step 4: Post-process each frame ──
    processed_dir = output_dir / "processed"
    processed_dir.mkdir(exist_ok=True)

    processed_files = []
    for src_img in sorted(frame_dir.glob("*.png")):
        dst_img = processed_dir / f"{src_img.stem}_pixel_{args.size}px.png"
        run_post_processor(src_img, dst_img, palette=args.palette, size=args.size)
        if dst_img.exists():
            processed_files.append(dst_img)

    if not processed_files:
        log("⚠️ No processed images — check pixel-post-processor.py")
        # Fall back: copy raw images as "processed"
        for src in generated_images:
            dst = processed_dir / src.name
            shutil.copy2(str(src), str(dst))
            processed_files.append(dst)

    # ── Step 5: Compile sprite sheet ──
    sheet_path = output_dir / f"{sprite_slug}_spritesheet_{args.size}px.png"
    sheet_result = create_sprite_sheet(processed_dir, sheet_path, args.sprite)

    # ── Step 6: Create metadata ──
    frame_names = [f.stem for f in sorted(processed_dir.glob("*.png"))]
    meta = create_metadata(
        sprite_name=args.sprite,
        frames=frame_names,
        frame_dir=processed_dir,
        sheet_path=sheet_result,
        theme=args.theme,
        palette=args.palette,
        size=args.size,
    )
    meta_path = output_dir / f"{sprite_slug}_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    log(f"Metadata saved: {meta_path}")

    # ── Summary ──
    print(f"\n{'═' * 50}")
    print(f"✅ FORGE COMPLETE: {args.sprite}")
    print(f"{'═' * 50}")
    print(f"   Frames: {frame_names}")
    print(f"   Pixel size: {args.size}x{args.size}")
    print(f"   Palette: {args.palette}")
    if sheet_result:
        print(f"   Sprite sheet: {sheet_result}")
    print(f"   All files: {output_dir}")
    print(f"   Metadata: {meta_path}")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
