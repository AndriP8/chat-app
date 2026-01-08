import type { Conversation, Message, User } from '../db/schema';

// User transformation
export interface UserResponse {
	id: string;
	email: string;
	name: string;
	profilePictureUrl: string | null;
	isDemo: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export function transformUserToResponse(dbUser: User): UserResponse {
	return {
		id: dbUser.id,
		email: dbUser.email,
		name: dbUser.name,
		profilePictureUrl: dbUser.profile_picture_url || null,
		isDemo: dbUser.is_demo,
		createdAt: dbUser.created_at,
		updatedAt: dbUser.updated_at,
	};
}

// Message transformation
export interface MessageResponse {
	id: string;
	content: string;
	status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
	senderId: string;
	conversationId: string;
	createdAt: Date;
	updatedAt: Date;
	tempId?: string | undefined;
	sequenceNumber?: number | null | undefined;
	sender?: UserResponse | undefined;
}

export function transformMessageToResponse(
	dbMessage: Message & { sender?: User; temp_id?: string | undefined }
): MessageResponse {
	const response: MessageResponse = {
		id: dbMessage.id,
		content: dbMessage.content,
		status: dbMessage.status as 'sending' | 'sent' | 'delivered' | 'read' | 'failed',
		senderId: dbMessage.sender_id,
		conversationId: dbMessage.conversation_id,
		createdAt: dbMessage.created_at,
		updatedAt: dbMessage.updated_at,
	};

	if (dbMessage.temp_id !== undefined) {
		response.tempId = dbMessage.temp_id;
	}

	if (dbMessage.sequence_number !== undefined) {
		response.sequenceNumber = dbMessage.sequence_number;
	}

	if (dbMessage.sender) {
		response.sender = transformUserToResponse(dbMessage.sender);
	}

	return response;
}

// Conversation transformation
export interface ConversationResponse {
	id: string;
	name: string | null;
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
	participants: UserResponse[];
	lastMessage?: MessageResponse | null;
}

export function transformConversationToResponse(
	dbConversation: Conversation & {
		participants?: User[];
		last_message?: (Message & { sender?: User }) | null;
	}
): ConversationResponse {
	return {
		id: dbConversation.id,
		name: dbConversation.name,
		createdBy: dbConversation.created_by,
		createdAt: dbConversation.created_at,
		updatedAt: dbConversation.updated_at,
		participants: dbConversation.participants
			? dbConversation.participants.map(transformUserToResponse)
			: [],
		lastMessage: dbConversation.last_message
			? transformMessageToResponse(dbConversation.last_message)
			: null,
	};
}
