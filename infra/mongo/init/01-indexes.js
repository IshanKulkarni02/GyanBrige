db = db.getSiblingDB('gyanbrige');

db.createCollection('chat_messages');
db.chat_messages.createIndex({ roomId: 1, createdAt: -1 });
db.chat_messages.createIndex({ senderId: 1, createdAt: -1 });
db.chat_messages.createIndex({ 'readBy.userId': 1 });

db.createCollection('chat_rooms');
db.chat_rooms.createIndex({ memberIds: 1, lastMessageAt: -1 });
db.chat_rooms.createIndex({ kind: 1, courseId: 1 });

db.createCollection('presence');
db.presence.createIndex({ userId: 1 }, { unique: true });
db.presence.createIndex({ lastSeen: 1 }, { expireAfterSeconds: 300 });

db.createCollection('notifications');
db.notifications.createIndex({ userId: 1, createdAt: -1 });
db.notifications.createIndex({ userId: 1, readAt: 1 });

db.createCollection('activity_feed');
db.activity_feed.createIndex({ userId: 1, updatedAt: -1 });

db.createCollection('live_polls');
db.live_polls.createIndex({ lectureId: 1, openedAt: -1 });
