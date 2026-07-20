import { supabase } from '../utils/supabaseClient'

export async function uploadQuestionImage(fileDataUrl, questionId) {
  try {
    // Convert base64 Data URL to Blob
    const response = await fetch(fileDataUrl);
    const blob = await response.blob();
    
    // Generate a unique filename
    const filename = `${Date.now()}_${questionId}.jpg`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('question-images')
      .upload(filename, blob, {
        contentType: 'image/jpeg',
        upsert: false
      });
      
    if (error) {
      console.error('Error uploading image to Supabase:', error);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('question-images')
      .getPublicUrl(filename);
      
    return publicUrl;
  } catch (error) {
    console.error('Failed to upload question image:', error);
    return null;
  }
}
