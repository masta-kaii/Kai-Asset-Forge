-- generate_dwarf.lua — Aseprite Lua script to generate a dwarf sprite
-- Run: Aseprite.exe --batch --script generate_dwarf.lua --script-param output=DIR

local outputDir = app.params["output"] or "C:/Users/khair/Kai-Asset-Forge/forge-output/aseprite-test"

-- Create new sprite
local sprite = Sprite(16, 28, ColorMode.INDEXED)
local pal = sprite.palettes[1]

-- PICO-8 colors
local colors = {
    {0,0,0},          -- 0 black/outline
    {29,43,83},       -- 1 dark blue  
    {126,37,83},      -- 2 dark purple
    {0,135,81},       -- 3 dark green
    {171,82,54},      -- 4 brown
    {95,87,79},       -- 5 dark gray
    {194,195,199},    -- 6 light gray
    {255,241,232},    -- 7 white
    {255,0,77},       -- 8 red
    {255,163,0},      -- 9 orange
    {255,236,39},     -- 10 yellow
    {0,228,54},       -- 11 green
    {41,173,255},     -- 12 cyan
    {131,118,156},    -- 13 lavender
    {255,119,168},    -- 14 pink
    {255,204,170},    -- 15 peach
}
for i = 1, #colors do
    pal:setColor(i-1, Color{ r=colors[i][1], g=colors[i][2], b=colors[i][3] })
end

-- Color shortcuts (PICO-8 indices, 0-based)
local O = 0   -- outline
local S = 7   -- skin (white-ish)
local H = 1   -- hair/helmet (dark blue)
local B = 5   -- beard/dark gray
local T = 4   -- shirt/torso (brown)
local P = 1   -- pants (dark blue)
local BT = 4  -- boots (brown)
local BL = 9  -- belt (orange)
local BK = 10 -- buckle (yellow)
local E = 7   -- eyes
local N = 15  -- nose (peach)

-- Get the active cel image
local cel = app.activeCel
if not cel then
    print("ERR: No active cel")
    return 1
end
local img = cel.image

-- Helper: set pixel
function ps(x, y, c)
    if x >= 0 and x < 16 and y >= 0 and y < 28 then
        img:drawPixel(x, y, c)
    end
end

-- Helper: fill rectangle
function fr(x, y, w, h, c)
    for py = y, y+h-1 do
        for px = x, x+w-1 do
            ps(px, py, c)
        end
    end
end

-- ═══ DRAW DWARF (16×28) ═══

-- LEGS
fr(5, 19, 2, 5, P)   -- left leg
fr(9, 19, 2, 5, P)   -- right leg
fr(4, 24, 3, 3, BT)  -- left boot
fr(9, 24, 3, 3, BT)  -- right boot

-- TORSO
fr(4, 10, 8, 9, T)

-- BELT
fr(4, 17, 8, 2, BL)
fr(7, 17, 2, 2, BK)  -- buckle

-- ARMS
fr(2, 10, 2, 8, T)   -- left arm
fr(12, 10, 2, 8, T)  -- right arm

-- HANDS
fr(2, 16, 2, 3, S)
fr(12, 16, 2, 3, S)

-- HEAD
fr(4, 1, 8, 8, S)

-- HELMET
fr(3, 0, 10, 3, H)   -- dome
fr(4, 3, 8, 2, H)    -- rim

-- EYES
ps(5, 4, E); ps(6, 4, E)
ps(9, 4, E); ps(10, 4, E)
ps(5, 4, O)  -- left pupil
ps(10, 4, O) -- right pupil

-- NOSE
ps(7, 6, N); ps(8, 6, N)

-- BEARD  
fr(5, 9, 6, 5, B)

-- MOUTH (under beard)
ps(7, 8, O)

-- ═══ OUTLINES ═══
-- Simple 1px outline: wherever there's a colored pixel next to a transparent one
for y = 0, 27 do
    for x = 0, 15 do
        local c = img:getPixel(x, y)
        if c >= 0 and c ~= O then
            -- Check 4 neighbors
            local neighbors = {{x-1,y},{x+1,y},{x,y-1},{x,y+1}}
            for _,n in ipairs(neighbors) do
                local nx, ny = n[1], n[2]
                if nx >= 0 and nx < 16 and ny >= 0 and ny < 28 then
                    local nc = img:getPixel(nx, ny)
                    if nc < 0 or nc == 0 then  -- transparent or black
                        ps(nx, ny, O)
                    end
                end
            end
        end
    end
end

-- SAVE
local filename = outputDir .. "/dwarf_idle_f0.png"
sprite:saveAs(filename)
print("✅ Dwarf sprite created: " .. filename)
app.exit()
