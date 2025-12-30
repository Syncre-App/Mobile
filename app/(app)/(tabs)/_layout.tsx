import { NativeTabs, Icon, Label, Badge } from 'expo-router/unstable-native-tabs';
import { useTheme } from '../../../hooks/useTheme';
import { useChatStore } from '../../../stores/chatStore';
import { useFriendStore } from '../../../stores/friendStore';

export default function TabLayout() {
  const { colors } = useTheme();
  const { unreadSummary } = useChatStore();
  const { pending } = useFriendStore();

  const totalUnread = unreadSummary?.total || 0;
  const pendingRequests = pending.incoming.length;

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      backgroundColor={null}
    >
      <NativeTabs.Trigger name="index">
        <Icon
          sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
        />
        <Label>Chats</Label>
        {totalUnread > 0 && (
          <Badge>{totalUnread > 99 ? '99+' : String(totalUnread)}</Badge>
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="friends">
        <Icon
          sf={{ default: 'person.2', selected: 'person.2.fill' }}
        />
        <Label>Friends</Label>
        {pendingRequests > 0 && (
          <Badge>{String(pendingRequests)}</Badge>
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
        />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
