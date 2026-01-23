import { mysqlTable, primaryKey, unique, int, varchar, index, bigint, json, binary, tinyint, datetime, char, float, varbinary, text, timestamp } from "drizzle-orm/mysql-core"
import { randomUUID } from 'node:crypto';
import { sql } from "drizzle-orm"
import { reportCategories, reportStatuses } from "./shared";

export const files = mysqlTable('files', {
  id: varchar({ length: 36 }).$defaultFn(() => randomUUID()).primaryKey(),
  // hash: text('hash').notNull(),
  filename: text('filename').notNull(),
  mimetype: text('mimetype').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type File = typeof files.$inferSelect;
export type InsertFile = typeof files.$inferInsert;

export const factions = mysqlTable('factions', {
	id: varchar({ length: 36 }).$defaultFn(() => randomUUID()).primaryKey(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	name: varchar('name', { length: 64 }).notNull(),
	description: varchar('description', { length: 2048 }).notNull(),
	placedPixels: int('placed_pixels', { unsigned: true }).default(0).notNull(),
	links: json('links').$type<FactionLinks>().default([]).notNull(),
	minPixelsToJoin: int('min_pixels_to_join', { unsigned: true }).notNull(),
});

export type FactionLinks = {
	label: string;
	href: string;
}[];

export type Faction = typeof factions.$inferSelect;
export type InsertFaction = typeof factions.$inferInsert;

export type ReportCategories = (typeof reportCategories)[number];
export type ReportStatuses = (typeof reportStatuses)[number];

export const reports = mysqlTable('reports', {
	id: varchar({ length: 36 }).$defaultFn(() => randomUUID()).primaryKey(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	createdBy: int({ unsigned: true }).notNull().references(() => users.id),
	telegram: varchar({ length: 32 }),
	discord: varchar({ length: 32 }),
	title: varchar({ length: 64 }).notNull(),
	text: varchar({ length: 2048 }).notNull(),
	category: varchar({ length: 32 }).$type<ReportCategories>().notNull(),
	status: varchar({ length: 32}).$type<ReportStatuses>().notNull().default('open'),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

// ниже таблицы, автоматически выведенные из бд
export const badges = mysqlTable("Badges", {
	id: int({ unsigned: true }).autoincrement().notNull(),
	name: varchar({ length: 32 }).notNull(),
	description: varchar({ length: 200 }).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "Badges_id"}),
	unique("name").on(table.name),
]);

export const banHistories = mysqlTable("BanHistories", {
	id: bigint({ mode: "number", unsigned: true }).notNull(),
	uuid: binary({ length: 16 }).notNull(),
	reason: varchar({ length: 200 }).notNull(),
	flags: tinyint({ unsigned: true }).default(0).notNull(),
	started: datetime({ mode: 'string'}).notNull(),
	ended: datetime({ mode: 'string'}).notNull(),
	liftedAt: datetime({ mode: 'string'}),
	muid: int({ unsigned: true }).references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
	lmuid: int({ unsigned: true }).references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => [
	index("lmuid").on(table.lmuid),
	index("muid").on(table.muid),
	primaryKey({ columns: [table.id], name: "BanHistories_id"}),
	unique("uuid").on(table.uuid),
]);

export const bans = mysqlTable("Bans", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	uuid: binary({ length: 16 }).notNull(),
	reason: varchar({ length: 200 }).notNull(),
	flags: tinyint({ unsigned: true }).default(0).notNull(),
	expires: datetime({ mode: 'string'}),
	createdAt: datetime({ mode: 'string'}).notNull(),
	muid: int({ unsigned: true }).references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => [
	index("muid").on(table.muid),
	primaryKey({ columns: [table.id], name: "Bans_id"}),
	unique("uuid").on(table.uuid),
]);

export const channels = mysqlTable("Channels", {
	id: int({ unsigned: true }).autoincrement().notNull(),
	name: varchar({ length: 32 }),
	type: tinyint({ unsigned: true }).notNull(),
	lastMessage: datetime({ mode: 'string'}).notNull(),
	createdAt: datetime({ mode: 'string'}).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "Channels_id"}),
]);

export const devices = mysqlTable("Devices", {
	id: int({ unsigned: true }).autoincrement().notNull(),
	hash: char({ length: 15 }).notNull(),
	os: varchar({ length: 20 }),
	browser: varchar({ length: 20 }),
	device: varchar({ length: 20 }),
	headerSig: char({ length: 12 }).notNull(),
	lastSeen: datetime({ mode: 'string'}).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "Devices_id"}),
	unique("hash").on(table.hash),
]);

export const fishes = mysqlTable("Fishes", {
	id: int({ unsigned: true }).autoincrement().notNull(),
	uid: int({ unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	type: tinyint({ unsigned: true }).notNull(),
	size: float().notNull(),
	createdAt: datetime({ mode: 'string'}).notNull(),
},
(table) => [
	index("uid").on(table.uid),
	primaryKey({ columns: [table.id], name: "Fishes_id"}),
]);

export const ipBanHistories = mysqlTable("IPBanHistories", {
	bid: bigint({ mode: "number", unsigned: true }).notNull().references(() => banHistories.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	ip: varbinary({ length: 8 }).notNull().references(() => ips.ip, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => [
	index("ip").on(table.ip),
	primaryKey({ columns: [table.bid, table.ip], name: "IPBanHistories_bid_ip"}),
]);

export const ipBans = mysqlTable("IPBans", {
	bid: bigint({ mode: "number", unsigned: true }).notNull().references(() => bans.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	ip: varbinary({ length: 8 }).notNull().references(() => ips.ip, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => [
	index("ip").on(table.ip),
	primaryKey({ columns: [table.bid, table.ip], name: "IPBans_bid_ip"}),
]);

export const ips = mysqlTable("IPs", {
	ip: varbinary({ length: 8 }).notNull(),
	uuid: binary({ length: 16 }).notNull(),
	lastSeen: datetime({ mode: 'string'}).notNull(),
	rid: int({ unsigned: true }).references(() => ranges.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => [
	index("rid").on(table.rid),
	primaryKey({ columns: [table.ip], name: "IPs_ip"}),
	unique("uuid").on(table.uuid),
]);

export const messages = mysqlTable("Messages", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	cid: int({ unsigned: true }).notNull().references(() => channels.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	uid: int({ unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	flag: char({ length: 2 }).default('xx').notNull(),
	message: varchar({ length: 200 }).notNull(),
	createdAt: datetime({ mode: 'string'}).notNull(),
},
(table) => [
	index("messages_cid_id_desc").on(table.cid, table.id),
	index("uid").on(table.uid),
	primaryKey({ columns: [table.id], name: "Messages_id"}),
]);

export const oidcAccessTokens = mysqlTable("OIDCAccessTokens", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	cid: bigint({ mode: "number", unsigned: true }).notNull().references(() => oidcConsents.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	token: char({ length: 80 }).notNull(),
	scope: varchar({ length: 255 }).notNull(),
	createdAt: datetime({ mode: 'string'}).notNull(),
	expires: datetime({ mode: 'string'}).notNull(),
},
(table) => [
	index("cid").on(table.cid),
	primaryKey({ columns: [table.id], name: "OIDCAccessTokens_id"}),
	unique("token").on(table.token),
]);

export const oidcAuthCodes = mysqlTable("OIDCAuthCodes", {
	id: int({ unsigned: true }).autoincrement().notNull(),
	cid: bigint({ mode: "number", unsigned: true }).notNull().references(() => oidcConsents.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	code: char({ length: 80 }).notNull(),
	scope: varchar({ length: 255 }).notNull(),
	nonce: varchar({ length: 255 }),
	authAge: int({ unsigned: true }),
	pkceChallenge: varchar({ length: 255 }),
	pkceMethod: varchar({ length: 10 }),
	createdAt: datetime({ mode: 'string'}).notNull(),
	expires: datetime({ mode: 'string'}).notNull(),
},
(table) => [
	index("cid").on(table.cid),
	primaryKey({ columns: [table.id], name: "OIDCAuthCodes_id"}),
	unique("code").on(table.code),
]);

export const oidcClients = mysqlTable("OIDCClients", {
	id: int({ unsigned: true }).autoincrement().notNull(),
	uid: int({ unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	name: varchar({ length: 255 }).notNull(),
	uuid: binary({ length: 16 }).notNull(),
	secret: char({ length: 40 }).notNull(),
	image: varchar({ length: 255 }),
	redirectUris: text().notNull(),
	scope: varchar({ length: 255 }).default('openid profile email').notNull(),
	defaultScope: varchar({ length: 255 }),
	autoGrant: tinyint().default(0).notNull(),
	lastUsed: datetime({ mode: 'string'}),
	createdAt: datetime({ mode: 'string'}).notNull(),
},
(table) => [
	index("uid").on(table.uid),
	primaryKey({ columns: [table.id], name: "OIDCClients_id"}),
	unique("name").on(table.name),
	unique("uuid").on(table.uuid),
]);

export const oidcConsents = mysqlTable("OIDCConsents", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	uid: int({ unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	cid: int({ unsigned: true }).notNull().references(() => oidcClients.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	scope: varchar({ length: 255 }).notNull(),
	consentedAt: datetime({ mode: 'string'}).notNull(),
	expires: datetime({ mode: 'string'}),
},
(table) => [
	index("cid").on(table.cid),
	primaryKey({ columns: [table.id], name: "OIDCConsents_id"}),
	unique("uidcid").on(table.uid, table.cid),
]);

export const oidcRefreshTokens = mysqlTable("OIDCRefreshTokens", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	cid: bigint({ mode: "number", unsigned: true }).notNull().references(() => oidcConsents.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	token: char({ length: 80 }).notNull(),
	scope: varchar({ length: 255 }).notNull(),
	createdAt: datetime({ mode: 'string'}).notNull(),
	expires: datetime({ mode: 'string'}).notNull(),
},
(table) => [
	index("cid").on(table.cid),
	primaryKey({ columns: [table.id], name: "OIDCRefreshTokens_id"}),
	unique("token").on(table.token),
]);

export const proxies = mysqlTable("Proxies", {
	ip: varbinary({ length: 8 }).notNull().references(() => ips.ip, { onDelete: "cascade", onUpdate: "cascade" } ),
	isProxy: tinyint().notNull(),
	type: varchar({ length: 20 }),
	operator: varchar({ length: 60 }),
	city: varchar({ length: 60 }),
	devices: int({ unsigned: true }).default(1).notNull(),
	subnetDevices: int({ unsigned: true }).default(1).notNull(),
	expires: datetime({ mode: 'string'}).notNull(),
},
(table) => [
	primaryKey({ columns: [table.ip], name: "Proxies_ip"}),
]);

export const proxyWhitelists = mysqlTable("ProxyWhitelists", {
	ip: varbinary({ length: 8 }).notNull().references(() => ips.ip, { onDelete: "cascade", onUpdate: "cascade" } ),
	reason: varchar({ length: 200 }),
	createdAt: datetime({ mode: 'string'}).notNull(),
	muid: int({ unsigned: true }).references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => [
	index("muid").on(table.muid),
	primaryKey({ columns: [table.ip], name: "ProxyWhitelists_ip"}),
]);

export const rangeBanHistories = mysqlTable("RangeBanHistories", {
	id: int({ unsigned: true }).autoincrement().notNull(),
	reason: tinyint({ unsigned: true }).notNull(),
	started: datetime({ mode: 'string'}).notNull(),
	ended: datetime({ mode: 'string'}).notNull(),
	liftedAt: datetime({ mode: 'string'}),
	rid: int({ unsigned: true }).references(() => ranges.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	muid: int({ unsigned: true }).references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
	lmuid: int({ unsigned: true }).references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => [
	index("lmuid").on(table.lmuid),
	index("muid").on(table.muid),
	index("rid").on(table.rid),
	primaryKey({ columns: [table.id], name: "RangeBanHistories_id"}),
]);

export const rangeBans = mysqlTable("RangeBans", {
	rid: int({ unsigned: true }).notNull().references(() => ranges.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	reason: tinyint({ unsigned: true }).notNull(),
	expires: datetime({ mode: 'string'}),
	createdAt: datetime({ mode: 'string'}).notNull(),
	muid: int({ unsigned: true }).references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => [
	index("muid").on(table.muid),
	primaryKey({ columns: [table.rid], name: "RangeBans_rid"}),
]);

export const ranges = mysqlTable("Ranges", {
	id: int({ unsigned: true }).autoincrement().notNull(),
	min: varbinary({ length: 8 }).notNull(),
	max: varbinary({ length: 8 }).notNull(),
	mask: tinyint({ unsigned: true }).notNull(),
	country: char({ length: 2 }).default('xx').notNull(),
	org: varchar({ length: 60 }),
	descr: varchar({ length: 60 }),
	asn: int({ unsigned: true }),
	expires: datetime({ mode: 'string'}).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "Ranges_id"}),
	unique("max").on(table.max),
	unique("min").on(table.min),
]);

export const sessions = mysqlTable("Sessions", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	uid: int({ unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	token: char({ length: 38 }).notNull(),
	country: char({ length: 2 }).default('xx').notNull(),
	expires: datetime({ mode: 'string'}),
	createdAt: datetime({ mode: 'string'}).notNull(),
	ip: varbinary({ length: 8 }).references(() => ips.ip, { onDelete: "set null", onUpdate: "cascade" } ),
	did: int({ unsigned: true }).references(() => devices.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => [
	index("did").on(table.did),
	index("ip").on(table.ip),
	index("uid").on(table.uid),
	primaryKey({ columns: [table.id], name: "Sessions_id"}),
	unique("token").on(table.token),
]);

export const threePidBanHistories = mysqlTable("ThreePIDBanHistories", {
	bid: bigint({ mode: "number", unsigned: true }).notNull().references(() => banHistories.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	tid: int({ unsigned: true }).notNull().references(() => threePiDs.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => [
	index("tid").on(table.tid),
	primaryKey({ columns: [table.bid, table.tid], name: "ThreePIDBanHistories_bid_tid"}),
]);

export const threePidBans = mysqlTable("ThreePIDBans", {
	bid: bigint({ mode: "number", unsigned: true }).notNull().references(() => bans.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	tid: int({ unsigned: true }).notNull().references(() => threePiDs.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => [
	index("tid").on(table.tid),
	primaryKey({ columns: [table.bid, table.tid], name: "ThreePIDBans_bid_tid"}),
]);

export const threePidHistories = mysqlTable("ThreePIDHistories", {
	id: int({ unsigned: true }).autoincrement().notNull(),
	uid: int({ unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	provider: tinyint({ unsigned: true }).notNull(),
	tpid: varchar({ length: 80 }).notNull(),
	normalizedTpid: varchar({ length: 80 }),
	verified: tinyint().notNull(),
	lastSeen: datetime({ mode: 'string'}).notNull(),
	createdAt: datetime({ mode: 'string'}).notNull(),
},
(table) => [
	index("uid").on(table.uid),
	primaryKey({ columns: [table.id], name: "ThreePIDHistories_id"}),
]);

export const threePiDs = mysqlTable("ThreePIDs", {
	id: int({ unsigned: true }).autoincrement().notNull(),
	provider: tinyint({ unsigned: true }).notNull(),
	tpid: varchar({ length: 80 }).notNull(),
	normalizedTpid: varchar({ length: 80 }).generatedAlwaysAs(sql`(case when (\`provider\` <> 1) then NULL when (locate(_utf8mb4\'@\',\`tpid\`) = 0) then NULL else lower(concat(replace(substring_index(substring_index(\`tpid\`,_utf8mb4\'@\',1),_utf8mb4\'+\',1),_utf8mb4\'.\',_utf8mb4\'\'),_utf8mb4\'@\',substring_index(\`tpid\`,_utf8mb4\'@\',-(1)))) end)`, { mode: "stored" }),
	verified: tinyint().default(0).notNull(),
	lastSeen: datetime({ mode: 'string'}).notNull(),
	createdAt: datetime({ mode: 'string'}).notNull(),
	uid: int({ unsigned: true }).references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => [
	index("uid").on(table.uid),
	primaryKey({ columns: [table.id], name: "ThreePIDs_id"}),
	unique("pntpid").on(table.provider, table.normalizedTpid),
	unique("ptpid").on(table.provider, table.tpid),
]);

export const userBadges = mysqlTable("UserBadges", {
	id: int({ unsigned: true }).autoincrement().notNull(),
	note: varchar({ length: 200 }),
	createdAt: datetime({ mode: 'string'}).notNull(),
	bid: int({ unsigned: true }).references(() => badges.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	uid: int({ unsigned: true }).references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => [
	index("uid").on(table.uid),
	primaryKey({ columns: [table.id], name: "UserBadges_id"}),
	unique("UserBadges_uid_bid_unique").on(table.bid, table.uid),
]);

export const userBanHistories = mysqlTable("UserBanHistories", {
	bid: bigint({ mode: "number", unsigned: true }).notNull().references(() => banHistories.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	uid: int({ unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => [
	index("uid").on(table.uid),
	primaryKey({ columns: [table.bid, table.uid], name: "UserBanHistories_bid_uid"}),
]);

export const userBans = mysqlTable("UserBans", {
	bid: bigint({ mode: "number", unsigned: true }).notNull().references(() => bans.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	uid: int({ unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => [
	index("uid").on(table.uid),
	primaryKey({ columns: [table.bid, table.uid], name: "UserBans_bid_uid"}),
]);

export const userBlocks = mysqlTable("UserBlocks", {
	uid: int({ unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	buid: int({ unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => [
	index("buid").on(table.buid),
	primaryKey({ columns: [table.uid, table.buid], name: "UserBlocks_uid_buid"}),
]);

export const userChannels = mysqlTable("UserChannels", {
	lastRead: datetime({ mode: 'string'}).notNull(),
	uid: int({ unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	cid: int({ unsigned: true }).notNull().references(() => channels.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => [
	index("cid").on(table.cid),
	primaryKey({ columns: [table.uid, table.cid], name: "UserChannels_uid_cid"}),
]);

export const userIps = mysqlTable("UserIPs", {
	lastSeen: datetime({ mode: 'string'}).notNull(),
	ip: varbinary({ length: 8 }).notNull().references(() => ips.ip, { onDelete: "cascade", onUpdate: "cascade" } ),
	uid: int({ unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => [
	index("uid").on(table.uid),
	primaryKey({ columns: [table.ip, table.uid], name: "UserIPs_ip_uid"}),
]);

export const users = mysqlTable("Users", {
	id: int({ unsigned: true }).autoincrement().notNull(),
  avatarId: varchar({ length: 36 }).references(() => files.id),
  bannerId: varchar({ length: 36 }).references(() => files.id),
	username: varchar({ length: 32 }).notNull(),
	name: varchar({ length: 32 }).notNull(),
	password: char({ length: 60 }),
	userlvl: tinyint({ unsigned: true }).default(10).notNull(),
	flags: tinyint({ unsigned: true }).default(0).notNull(),
	lastSeen: datetime({ mode: 'string'}).notNull(),
	createdAt: datetime({ mode: 'string'}).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "Users_id"}),
	unique("name").on(table.name),
	unique("username").on(table.username),
]);

export type User = typeof users.$inferSelect;
export type UnmarshalledUser = Omit<User, 'lastSeen' | 'createdAt'> & {
	lastSeen: Date;
	createdAt: Date;
}
export type InsertUser = typeof users.$inferInsert;

export const whoisReferrals = mysqlTable("WhoisReferrals", {
	id: int({ unsigned: true }).autoincrement().notNull(),
	min: varbinary({ length: 8 }).notNull(),
	max: varbinary({ length: 8 }).notNull(),
	mask: tinyint({ unsigned: true }).notNull(),
	host: varchar({ length: 60 }).notNull(),
	expires: datetime({ mode: 'string'}).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "WhoisReferrals_id"}),
	unique("max").on(table.max),
	unique("min").on(table.min),
]);