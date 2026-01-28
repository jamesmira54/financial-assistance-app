export interface User {
    email: string;
    first_name: string;
    role_id: Uint8Array<ArrayBuffer>;
    middle_name?: string;
    last_name: string;
    mobile_number: string;
    password: string;
    created_at?: Date;
    updated_at?: Date;
    created_by?: Uint8Array<ArrayBuffer>;
    updated_by?: Uint8Array<ArrayBuffer>;
    recordStatus?: boolean;
}

export interface UserRole {
  user_id: Uint8Array<ArrayBuffer>;
  role_id: Uint8Array<ArrayBuffer>;
}
