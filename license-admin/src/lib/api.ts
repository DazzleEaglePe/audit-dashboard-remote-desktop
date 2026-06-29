const BASE = import.meta.env.VITE_LICENSE_API_URL ?? '';

export function getToken(): string { 
  return localStorage.getItem('eca_admin_token') ?? ''; 
}

export function setToken(t: string): void { 
  localStorage.setItem('eca_admin_token', t); 
}

export async function validateToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/admin/keys`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...options.headers,
    },
  });

  if (res.status === 401) { 
    setToken(''); 
    window.location.reload(); // Force full reload to reset state and go back to TokenGate
    throw new Error('No autorizado'); 
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${res.status}`);
  }

  return res.json() as Promise<T>;
}
