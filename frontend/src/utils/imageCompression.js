/**
 * Compress an image file for faster upload
 * @param {File} file - The image file to compress
 * @param {number} maxSize - Maximum dimension (width or height) in pixels
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<File>} - Compressed image file
 */
export const compressImage = async (file, maxSize = 1024, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Calculate new dimensions
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
  });
};

/**
 * Compress multiple image files
 * @param {File[]} files - Array of image files
 * @param {number} maxSize - Maximum dimension
 * @param {number} quality - JPEG quality
 * @returns {Promise<File[]>} - Array of compressed files
 */
export const compressImages = async (files, maxSize = 800, quality = 0.8) => {
  const compressed = await Promise.all(
    files.map(file => compressImage(file, maxSize, quality))
  );
  return compressed;
};
