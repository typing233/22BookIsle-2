import { ref, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';

export function useWebSocket() {
  const connected = ref(false);
  const scanProgress = ref<any>(null);
  let ws: WebSocket | null = null;
  let reconnectTimer: any = null;

  function connect() {
    const authStore = useAuthStore();
    if (!authStore.accessToken) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws?token=${authStore.accessToken}`;

    ws = new WebSocket(url);

    ws.onopen = () => {
      connected.value = true;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'scan_progress') {
          scanProgress.value = msg.data;
        }
      } catch {}
    };

    ws.onclose = () => {
      connected.value = false;
      reconnectTimer = setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
    ws = null;
  }

  onMounted(connect);
  onUnmounted(disconnect);

  return { connected, scanProgress };
}
