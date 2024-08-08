const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const FormData = require('form-data');

// Replace with your access token, page ID, and album ID
const ACCESS_TOKEN = 'EAAMQfKV8wSMBOzXoiVvxZAmIeZBH3XGyyhD2Y9bZBIOtHU86TPZBySXegF90btPhAmY0mgBGwwwWhVa29Oxm5kGZCBApwIHB5J1aQMmIhaK9DuQhhLVpzZBcFh4Bhibp2jjdsMNx9TGtxqOD25OP80bQigorvR93VHRd5xEPZBC05Hml9MTrokPqn9nsMO3yySzxfoe4AtqgKJayTEVCrHKzO829xbOWZBvA';
const PAGE_ID = '385154768014522';
const ALBUM_ID = '122106373046450892'; // Replace with your album ID

// Path to the images directory
const imagesDir = path.join(__dirname, 'images');

// Create the images directory if it doesn't exist
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}

// Function to create a badge image with a given discount percentage
async function createBadge(badgePath, discount) {
  try {
    const svgBadge = `
     <svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <!-- Background circle -->
      <circle cx="200" cy="200" r="150" fill="#e43530" stroke="#fff" stroke-width="10"/>
      <!-- Discount text -->
      <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="'Arial Black', Gadget, sans-serif" font-size="80" fill="#fff" stroke="#000" stroke-width="1">${discount}%</text>
      <text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" font-family="'Arial Black', Gadget, sans-serif" font-size="60" fill="yellow" stroke="#000" stroke-width="1">OFF</text>
    </svg>
    `;

    await sharp(Buffer.from(svgBadge))
      .toFile(badgePath);

    console.log(`Badge with ${discount}% created successfully.`);
  } catch (error) {
    console.error('Error creating badge:', error);
  }
}

// Function to download an image from a URL
async function downloadImage(url, filepath) {
  const response = await axios({
    url,
    responseType: 'arraybuffer'
  });
  fs.writeFileSync(filepath, response.data);
}

// Function to add a badge to an image
async function addBadgeToImage(imagePath, badgePath, outputPath) {
  try {
    const image = sharp(imagePath);
    const badge = await sharp(badgePath).resize(300, 300).toBuffer(); // Resize badge if needed

    await image
      .composite([{ input: badge, gravity: 'southeast' }]) // Change 'gravity' to position the badge as needed
      .toFile(outputPath);

    console.log('Badge added to image successfully.');
  } catch (error) {
    console.error('Error adding badge to image:', error);
  }
}

// Function to get all image file paths from the directory
function getImagePaths() {
  return fs.readdirSync(imagesDir)
    .filter(file => file.endsWith('.jpg') || file.endsWith('.png')) // Adjust extensions if needed
    .map(file => path.join(imagesDir, file));
}

// Function to upload images to the album
async function uploadImagesToAlbum() {
  try {
    // Get all image paths from the directory
    const imagePaths = getImagePaths();

    // Loop through each image and upload it
    for (const imagePath of imagePaths) {
      const form = new FormData();
      form.append('source', fs.createReadStream(imagePath));
      form.append('access_token', ACCESS_TOKEN);

      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `https://graph.facebook.com/v12.0/${ALBUM_ID}/photos`,
        headers: { 
          ...form.getHeaders()
        },
        data: form
      };

      const response = await axios.request(config);
      console.log(`Image uploaded: ${response.data.id}`);
    }

    console.log('All images uploaded successfully.');
  } catch (error) {
    console.error('Error uploading images:', error.response ? error.response.data : error.message);
  }
}

// Function to process each row from the .xlsx file
async function processXlsxFile(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  console.log(data);

  for (const row of data) {
    const { image, discount } = row;
    console.log(image, discount);

    if (image && discount) {
      const localImagePath = path.join(imagesDir, `downloaded_image_${discount}.jpg`);
      const badgePath = path.join(imagesDir, `badge_${discount}.png`);
      const outputImagePath = path.join(imagesDir, `output_image_${discount}.jpg`);

      // Create the badge
      await createBadge(badgePath, discount);

      // Download the image
      await downloadImage(image, localImagePath);

      // Add the badge to the downloaded image
      await addBadgeToImage(localImagePath, badgePath, outputImagePath);

      // Clean up: delete the downloaded image and badge
      fs.unlinkSync(localImagePath);
      fs.unlinkSync(badgePath);
    }
  }
}

// Path to the .xlsx file
const xlsxFilePath = path.join(__dirname, 'Book1.xlsx');

// Process the .xlsx file and then upload the images to the album
processXlsxFile(xlsxFilePath)
  .then(() => uploadImagesToAlbum())
  .then(() => console.log('All images processed and uploaded successfully.'))
  .catch(error => console.error('Error processing images:', error));
