import { ref, computed } from 'vue';
import type { Digest } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

export function useDigest() {
  const digest = ref<Digest | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchToday() {
    loading.value = true;
    error.value = null;

    try {
      const res = await fetch(`${API_BASE}/api/today`);
      if (!res.ok) {
        if (res.status === 404) {
          error.value = 'No digest yet today. Check back at 5pm!';
          return;
        }
        throw new Error('Failed to fetch');
      }
      digest.value = await res.json();
    } catch (e) {
      error.value = 'Failed to load digest';
      console.error(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchDate(date: string) {
    loading.value = true;
    error.value = null;

    try {
      const res = await fetch(`${API_BASE}/api/digest/${date}`);
      if (!res.ok) throw new Error('Failed to fetch');
      digest.value = await res.json();
    } catch (e) {
      error.value = 'Failed to load digest';
      console.error(e);
    } finally {
      loading.value = false;
    }
  }

  const formattedDate = computed(() => {
    if (!digest.value) return '';
    return new Date(digest.value.date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  });

  return {
    digest,
    loading,
    error,
    formattedDate,
    fetchToday,
    fetchDate
  };
}
