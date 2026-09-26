import { supabase } from '../utils/supabaseClient'

export const getNotificationSettings = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('accessibility_settings')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data.accessibility_settings || {};
}

export const updateNotificationSettings = async (userId, newSettings) => {
  // Merge with existing accessibility settings
  const { data: profile } = await supabase
    .from('profiles')
    .select('accessibility_settings')
    .eq('id', userId)
    .maybeSingle();

  const currentSettings = profile?.accessibility_settings || {};
  const updatedSettings = { ...currentSettings, ...newSettings };

  const { data, error } = await supabase
    .from('profiles')
    .update({ accessibility_settings: updatedSettings })
    .eq('id', userId);

  if (error) throw error;
  return updatedSettings;
}

export const subscribeToPush = async (userId, subscription) => {
  // Store the web push subscription object in the profiles table (under accessibility_settings.pushSubscription)
  const settings = await getNotificationSettings(userId);
  settings.pushSubscription = subscription;
  await updateNotificationSettings(userId, settings);
}

export const getNotifications = async (userId) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50); // Get latest 50

  if (error) {
    console.error('Failed to get notifications', error);
    return [];
  }
  return data;
}

export const markAsRead = async (notificationId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

export const markAllAsRead = async (userId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId);
  if (error) throw error;
}

export const deleteNotification = async (notificationId) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);
  if (error) throw error;
}

// Function to trigger a new notification
export const createNotification = async (userId, { title, message, type, actionUrl }) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type, // 'result', 'reminder', 'new_test', 'system'
        action_url: actionUrl,
        is_read: false
      })
      .select()
      .single();

    if (error) throw error;

    // Send local browser notification if permitted and settings allow
    const settings = await getNotificationSettings(userId);
    if (settings.notifyPush && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: type,
        data: { url: actionUrl }
      });
    }

    // In a production app, an Edge Function would trigger email sending here based on settings.notifyEmail.
    
    return data;
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}
