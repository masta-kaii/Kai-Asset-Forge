const fs = require('fs');
const path = require('path');

const pyPath = path.join(__dirname, '../pixel-post-processor.py');
let py = fs.readFileSync(pyPath, 'utf8');

// Replace pixel_downscale with a smooth downscale + quantize approach
const newDownscale = `def pixel_downscale(arr: np.ndarray, target_size: int) -> np.ndarray:
    """
    Downscale using high-quality anti-aliasing FIRST to average out the SDXL noise,
    then we will snap to the palette later.
    """
    h, w = arr.shape[:2]
    
    if h != w:
        size = max(h, w)
        square = np.zeros((size, size, 4), dtype=np.uint8)
        if arr.shape[-1] == 4:
            square[:, :, 3] = 0
        y_off = (size - h) // 2
        x_off = (size - w) // 2
        square[y_off:y_off + h, x_off:x_off + w] = arr
        arr = square
        
    img = Image.fromarray(arr, mode="RGBA")
    # Using LANCZOS averages the pixels out smoothly, removing the extreme noise
    img_resized = img.resize((target_size, target_size), Image.Resampling.LANCZOS)
    
    # Sharp alpha threshold
    out_arr = np.array(img_resized)
    out_arr[out_arr[:, :, 3] < 128, 3] = 0
    out_arr[out_arr[:, :, 3] >= 128, 3] = 255
    
    return out_arr
`;

py = py.replace(/def pixel_downscale[\s\S]*?return np\.array\(img_resized\)/, newDownscale);

// Change the processing order in _process_single:
// 1. Crop
// 2. Downscale (Lanczos)
// 3. Quantize
// 4. Denoise
// 5. Outline
const newProcessSingle = `def _process_single(
    arr: np.ndarray,
    output_path: str,
    palette: str,
    do_outline: bool,
    do_denoise: bool,
    target_size: int,
) -> np.ndarray:
    # 1. Smart crop
    arr = smart_crop(arr, padding=6)
    print(f"  ✓ Cropped to {arr.shape[1]}×{arr.shape[0]}")
    
    # 2. Downscale FIRST with anti-aliasing to remove noise
    arr = pixel_downscale(arr, target_size)
    print(f"  ✓ Downscaled to {target_size}×{target_size} (Lanczos)")
    
    # 3. Quantize to retro palette to snap the blurred edges to crisp pixel boundaries
    arr = quantize_to_palette(arr, palette)
    print(f"  ✓ Quantized to {palette} palette")
    
    # 4. Remove noise
    if do_denoise:
        arr = remove_noise(arr, threshold=1)
        print(f"  ✓ Noise removed")
        
    # 5. Add outlines
    if do_outline:
        arr = add_outline(arr, (0, 0, 0))
        print(f"  ✓ Outlines added")
        
    # Save
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    save_image(arr, output_path)
    print(f"  ✓ Saved to {output_path}")
    
    return arr
`;

py = py.replace(/def _process_single\([\s\S]*?return arr/, newProcessSingle);

fs.writeFileSync(pyPath, py);
console.log('Updated python post-processor.');
