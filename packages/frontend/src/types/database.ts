export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  profilePictureUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
