CREATE TABLE chat_messages (id text PRIMARY KEY NOT NULL, group_id text NOT NULL REFERENCES groups(id), author text NOT NULL, body text NOT NULL, created integer NOT NULL);
CREATE INDEX chat_messages_group_created ON chat_messages(group_id, created);
CREATE TABLE chat_reactions (group_id text NOT NULL REFERENCES groups(id), target_id text NOT NULL, user_id text NOT NULL, emoji text NOT NULL, created integer NOT NULL, PRIMARY KEY(group_id,target_id,user_id,emoji));
