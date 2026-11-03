import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '../auth/AuthProvider';

export default function RootLayout() {
  return <AuthProvider><NotificationNavigation /><Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} /></AuthProvider>;
}

function NotificationNavigation() {
  const router = useRouter();
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as { jobId?: number; applicationId?: number; type?: string };
      if (!data.jobId) return;
      if (data.type === 'chat_message' && data.applicationId) router.push({ pathname: '/jobs/[id]/chat', params: { id: String(data.jobId), applicationId: String(data.applicationId) } });
      else router.push({ pathname: '/jobs/[id]', params: { id: String(data.jobId) } });
    });
    return () => subscription.remove();
  }, [router]);
  return null;
}
