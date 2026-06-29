export interface ActivationKey {
  id: number;
  key: string;
  customer_name: string;
  max_servers: number;
  plan: string;
  features: string | null;
  expires_days: number;
  status: 'active' | 'used' | 'revoked';
  used_by_install_id: string | null;
  max_activations: number;
  activation_count: number;
  created_at: string;
}

export interface NewKey {
  customerName: string;
  maxServers: number;
  plan?: string;
  features?: string;
  expiresDays?: number;
  maxActivations?: number;
}

export interface ReissueRequest {
  activationKey: string;
  newInstallId: string;
}

export interface RevokeRequest {
  activationKey: string;
}
