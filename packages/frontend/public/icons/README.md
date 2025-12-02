# PWA Icons

This directory contains the PWA icons for the Chat App.

## Icon Generation

The `icon.svg` file is the source icon. To generate all required PNG sizes, you can:

### Option 1: Use the generation script (recommended)

```bash
cd packages/frontend
node scripts/generate-icons.mjs
```

This will create all required icon sizes:
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png
- icon-maskable-192x192.png (with 40% safe zone)
- icon-maskable-512x512.png (with 40% safe zone)

### Option 2: Use an online tool

Visit https://realfavicongenerator.net/ and upload the icon.svg file to generate all required sizes.

### Option 3: Manual generation with ImageMagick

```bash
cd packages/frontend/public/icons
for size in 72 96 128 144 152 192 384 512; do
  convert icon.svg -resize ${size}x${size} icon-${size}x${size}.png
done
```

## Maskable Icons

Maskable icons ensure the icon looks good on all Android devices with different shaped icon masks.
They include a 40% safe zone where the critical content should be placed.

The generation script automatically creates maskable icons with the proper safe zone.

## Icon Design Guidelines

- Use a simple, recognizable design
- Ensure high contrast for visibility
- For maskable icons, keep important content within the 60% inner circle
- Background color: #3B82F6 (blue-500) to match the app theme
