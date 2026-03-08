import os
from openpyxl import load_workbook
from openpyxl.drawing.image import Image

# Create output folder
output_dir = r'e:\购物网站\luxury-shop\public\products'
os.makedirs(output_dir, exist_ok=True)

# Load Excel
excel_path = r'C:\Users\Administrator\Desktop\200个.xlsx'
wb = load_workbook(excel_path)
ws = wb.active

print(f"Loading: {excel_path}")
print(f"Output: {output_dir}")

# Get images from worksheet
images = ws._images
print(f"\nFound {len(images)} images")

# Extract each image
for i, img in enumerate(images):
    # Get image data
    img_data = img._data()

    # Determine row (image anchor)
    row = 0
    if hasattr(img.anchor, '_from'):
        row = img.anchor._from.row
    elif hasattr(img.anchor, 'row'):
        row = img.anchor.row

    # Save image
    filename = f"product_{i+1}.png"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, 'wb') as f:
        f.write(img_data)

    print(f"Saved: {filename} (row {row})")

print(f"\nDone! Extracted {len(images)} images to {output_dir}")
