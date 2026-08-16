import sys
from PIL import Image, ImageDraw

def mask_circle(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    
    # Make sure it's square
    size = min(img.size)
    
    # Crop to center
    left = (img.size[0] - size) / 2
    top = (img.size[1] - size) / 2
    right = (img.size[0] + size) / 2
    bottom = (img.size[1] + size) / 2
    img = img.crop((left, top, right, bottom))
    
    # Create circular mask
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size, size), fill=255)
    
    # Apply mask
    img.putalpha(mask)
    img.save(output_path, "PNG")

if __name__ == "__main__":
    mask_circle(sys.argv[1], sys.argv[2])
