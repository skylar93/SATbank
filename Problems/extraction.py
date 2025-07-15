
import fitz  # PyMuPDF
import os
import io
from PIL import Image

def extract_pdf_content(pdf_path, output_dir):
    """
    Extracts text and images from a PDF file.

    :param pdf_path: The path to the PDF file.
    :param output_dir: The directory where extracted images will be saved.
    """
    # 1. Ensure the output directory exists.
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created directory: {output_dir}")

    # 2. Open the PDF file using PyMuPDF (fitz).
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"Error opening PDF file: {e}")
        return

    print(f"Opened PDF: {pdf_path}")
    print(f"Number of pages: {doc.page_count}")
    print("-" * 20)

    # 3. Extract text from each page.
    print("\n--- Extracting Text ---\n")
    for page_num, page in enumerate(doc):
        # page.get_text() extracts the plain text from the page.
        text = page.get_text()
        print(f"--- Text from Page {page_num + 1} ---")
        if text.strip():
            print(text)
        else:
            print("[No text found on this page]")
        print("-" * 20)

    # 4. Extract images from the PDF.
    print("\n--- Extracting Images ---\n")
    image_count = 0
    # Iterate through all pages to find images.
    for page_num, page in enumerate(doc):
        # page.get_images(full=True) returns a list of images on the page.
        # Each item is a tuple containing image metadata.
        image_list = page.get_images(full=True)

        if not image_list:
            continue

        for image_index, img in enumerate(image_list):
            # The first element in the img tuple is the xref of the image.
            xref = img[0]

            # 5. Extract the raw image data.
            # doc.extract_image(xref) returns a dictionary with image bytes and extension.
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]

            # Generate a unique filename for the image.
            image_filename = f"image_p{page_num + 1}_{xref}.{image_ext}"
            image_path = os.path.join(output_dir, image_filename)

            # 6. Save the extracted image to the output directory.
            try:
                with open(image_path, "wb") as img_file:
                    img_file.write(image_bytes)
                image_count += 1
                print(f"Saved image: {image_path}")
            except Exception as e:
                print(f"Error saving image {image_path}: {e}")

    if image_count == 0:
        print("No images found in the PDF.")
    else:
        print(f"\nSuccessfully extracted {image_count} images to '{output_dir}'")

    # Close the PDF document.
    doc.close()

# --- Main execution block ---
if __name__ == "__main__":
    # NOTE: Replace 'sample.pdf' with the path to your PDF file.
    # You can create a dummy PDF or use an existing one to test the script.
    pdf_file_path = "Digital-SAT-December-2024-U-S-a.pdf"
    
    # Create a dummy PDF for demonstration if it doesn't exist.
    if not os.path.exists(pdf_file_path):
        print(f"'{pdf_file_path}' not found. Creating a dummy PDF for demonstration.")
        # Create a new blank PDF
        doc = fitz.open() 
        # Add a page
        page = doc.new_page()
        # Insert some text
        page.insert_text((50, 72), "This is the first page with some sample text.")
        page.insert_text((50, 92), "PDF parsing is a common task in data processing.")
        # Add a second page
        page2 = doc.new_page()
        page2.insert_text((50, 72), "This is the second page.")
        # As adding a real image programmatically is complex, we'll skip it for the dummy file.
        # This script will still correctly extract images from a real PDF that contains them.
        doc.save(pdf_file_path)
        doc.close()
        print(f"Dummy '{pdf_file_path}' created.")

    # Specify the directory to save extracted images.
    output_image_directory = "extracted_images"

    # Call the main function to perform extraction.
    extract_pdf_content(pdf_file_path, output_image_directory)
    print("\nExtraction process complete.")

