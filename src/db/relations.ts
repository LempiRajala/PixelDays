import { relations } from "drizzle-orm/relations";
import { users, banHistories, bans, fishes, ipBanHistories, ips, ipBans, ranges, channels, messages, oidcConsents, oidcAccessTokens, oidcAuthCodes, oidcClients, oidcRefreshTokens, proxies, proxyWhitelists, rangeBanHistories, rangeBans, sessions, devices, threePidBanHistories, threePiDs, threePidBans, threePidHistories, badges, userBadges, userBanHistories, userBans, userBlocks, userChannels, userIps } from "./schema";

// ниже отношения между таблицами, автоматически выведенные из бд
export const banHistoriesRelations = relations(banHistories, ({one, many}) => ({
	user_muid: one(users, {
		fields: [banHistories.muid],
		references: [users.id],
		relationName: "banHistories_muid_users_id"
	}),
	user_lmuid: one(users, {
		fields: [banHistories.lmuid],
		references: [users.id],
		relationName: "banHistories_lmuid_users_id"
	}),
	ipBanHistories: many(ipBanHistories),
	threePidBanHistories: many(threePidBanHistories),
	userBanHistories: many(userBanHistories),
}));

export const usersRelations = relations(users, ({many}) => ({
	banHistories_muid: many(banHistories, {
		relationName: "banHistories_muid_users_id"
	}),
	banHistories_lmuid: many(banHistories, {
		relationName: "banHistories_lmuid_users_id"
	}),
	bans: many(bans),
	fishes: many(fishes),
	messages: many(messages),
	oidcClients: many(oidcClients),
	oidcConsents: many(oidcConsents),
	proxyWhitelists: many(proxyWhitelists),
	rangeBanHistories_muid: many(rangeBanHistories, {
		relationName: "rangeBanHistories_muid_users_id"
	}),
	rangeBanHistories_lmuid: many(rangeBanHistories, {
		relationName: "rangeBanHistories_lmuid_users_id"
	}),
	rangeBans: many(rangeBans),
	sessions: many(sessions),
	threePidHistories: many(threePidHistories),
	threePiDs: many(threePiDs),
	userBadges: many(userBadges),
	userBanHistories: many(userBanHistories),
	userBans: many(userBans),
	userBlocks_uid: many(userBlocks, {
		relationName: "userBlocks_uid_users_id"
	}),
	userBlocks_buid: many(userBlocks, {
		relationName: "userBlocks_buid_users_id"
	}),
	userChannels: many(userChannels),
	userIps: many(userIps),
}));

export const bansRelations = relations(bans, ({one, many}) => ({
	user: one(users, {
		fields: [bans.muid],
		references: [users.id]
	}),
	ipBans: many(ipBans),
	threePidBans: many(threePidBans),
	userBans: many(userBans),
}));

export const fishesRelations = relations(fishes, ({one}) => ({
	user: one(users, {
		fields: [fishes.uid],
		references: [users.id]
	}),
}));

export const ipBanHistoriesRelations = relations(ipBanHistories, ({one}) => ({
	banHistory: one(banHistories, {
		fields: [ipBanHistories.bid],
		references: [banHistories.id]
	}),
	ip: one(ips, {
		fields: [ipBanHistories.ip],
		references: [ips.ip]
	}),
}));

export const ipsRelations = relations(ips, ({one, many}) => ({
	ipBanHistories: many(ipBanHistories),
	ipBans: many(ipBans),
	range: one(ranges, {
		fields: [ips.rid],
		references: [ranges.id]
	}),
	proxies: many(proxies),
	proxyWhitelists: many(proxyWhitelists),
	sessions: many(sessions),
	userIps: many(userIps),
}));

export const ipBansRelations = relations(ipBans, ({one}) => ({
	ban: one(bans, {
		fields: [ipBans.bid],
		references: [bans.id]
	}),
	ip: one(ips, {
		fields: [ipBans.ip],
		references: [ips.ip]
	}),
}));

export const rangesRelations = relations(ranges, ({many}) => ({
	ips: many(ips),
	rangeBanHistories: many(rangeBanHistories),
	rangeBans: many(rangeBans),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	channel: one(channels, {
		fields: [messages.cid],
		references: [channels.id]
	}),
	user: one(users, {
		fields: [messages.uid],
		references: [users.id]
	}),
}));

export const channelsRelations = relations(channels, ({many}) => ({
	messages: many(messages),
	userChannels: many(userChannels),
}));

export const oidcAccessTokensRelations = relations(oidcAccessTokens, ({one}) => ({
	oidcConsent: one(oidcConsents, {
		fields: [oidcAccessTokens.cid],
		references: [oidcConsents.id]
	}),
}));

export const oidcConsentsRelations = relations(oidcConsents, ({one, many}) => ({
	oidcAccessTokens: many(oidcAccessTokens),
	oidcAuthCodes: many(oidcAuthCodes),
	user: one(users, {
		fields: [oidcConsents.uid],
		references: [users.id]
	}),
	oidcClient: one(oidcClients, {
		fields: [oidcConsents.cid],
		references: [oidcClients.id]
	}),
	oidcRefreshTokens: many(oidcRefreshTokens),
}));

export const oidcAuthCodesRelations = relations(oidcAuthCodes, ({one}) => ({
	oidcConsent: one(oidcConsents, {
		fields: [oidcAuthCodes.cid],
		references: [oidcConsents.id]
	}),
}));

export const oidcClientsRelations = relations(oidcClients, ({one, many}) => ({
	user: one(users, {
		fields: [oidcClients.uid],
		references: [users.id]
	}),
	oidcConsents: many(oidcConsents),
}));

export const oidcRefreshTokensRelations = relations(oidcRefreshTokens, ({one}) => ({
	oidcConsent: one(oidcConsents, {
		fields: [oidcRefreshTokens.cid],
		references: [oidcConsents.id]
	}),
}));

export const proxiesRelations = relations(proxies, ({one}) => ({
	ip: one(ips, {
		fields: [proxies.ip],
		references: [ips.ip]
	}),
}));

export const proxyWhitelistsRelations = relations(proxyWhitelists, ({one}) => ({
	ip: one(ips, {
		fields: [proxyWhitelists.ip],
		references: [ips.ip]
	}),
	user: one(users, {
		fields: [proxyWhitelists.muid],
		references: [users.id]
	}),
}));

export const rangeBanHistoriesRelations = relations(rangeBanHistories, ({one}) => ({
	range: one(ranges, {
		fields: [rangeBanHistories.rid],
		references: [ranges.id]
	}),
	user_muid: one(users, {
		fields: [rangeBanHistories.muid],
		references: [users.id],
		relationName: "rangeBanHistories_muid_users_id"
	}),
	user_lmuid: one(users, {
		fields: [rangeBanHistories.lmuid],
		references: [users.id],
		relationName: "rangeBanHistories_lmuid_users_id"
	}),
}));

export const rangeBansRelations = relations(rangeBans, ({one}) => ({
	range: one(ranges, {
		fields: [rangeBans.rid],
		references: [ranges.id]
	}),
	user: one(users, {
		fields: [rangeBans.muid],
		references: [users.id]
	}),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.uid],
		references: [users.id]
	}),
	ip: one(ips, {
		fields: [sessions.ip],
		references: [ips.ip]
	}),
	device: one(devices, {
		fields: [sessions.did],
		references: [devices.id]
	}),
}));

export const devicesRelations = relations(devices, ({many}) => ({
	sessions: many(sessions),
}));

export const threePidBanHistoriesRelations = relations(threePidBanHistories, ({one}) => ({
	banHistory: one(banHistories, {
		fields: [threePidBanHistories.bid],
		references: [banHistories.id]
	}),
	threePiD: one(threePiDs, {
		fields: [threePidBanHistories.tid],
		references: [threePiDs.id]
	}),
}));

export const threePiDsRelations = relations(threePiDs, ({one, many}) => ({
	threePidBanHistories: many(threePidBanHistories),
	threePidBans: many(threePidBans),
	user: one(users, {
		fields: [threePiDs.uid],
		references: [users.id]
	}),
}));

export const threePidBansRelations = relations(threePidBans, ({one}) => ({
	ban: one(bans, {
		fields: [threePidBans.bid],
		references: [bans.id]
	}),
	threePiD: one(threePiDs, {
		fields: [threePidBans.tid],
		references: [threePiDs.id]
	}),
}));

export const threePidHistoriesRelations = relations(threePidHistories, ({one}) => ({
	user: one(users, {
		fields: [threePidHistories.uid],
		references: [users.id]
	}),
}));

export const userBadgesRelations = relations(userBadges, ({one}) => ({
	badge: one(badges, {
		fields: [userBadges.bid],
		references: [badges.id]
	}),
	user: one(users, {
		fields: [userBadges.uid],
		references: [users.id]
	}),
}));

export const badgesRelations = relations(badges, ({many}) => ({
	userBadges: many(userBadges),
}));

export const userBanHistoriesRelations = relations(userBanHistories, ({one}) => ({
	banHistory: one(banHistories, {
		fields: [userBanHistories.bid],
		references: [banHistories.id]
	}),
	user: one(users, {
		fields: [userBanHistories.uid],
		references: [users.id]
	}),
}));

export const userBansRelations = relations(userBans, ({one}) => ({
	ban: one(bans, {
		fields: [userBans.bid],
		references: [bans.id]
	}),
	user: one(users, {
		fields: [userBans.uid],
		references: [users.id]
	}),
}));

export const userBlocksRelations = relations(userBlocks, ({one}) => ({
	user_uid: one(users, {
		fields: [userBlocks.uid],
		references: [users.id],
		relationName: "userBlocks_uid_users_id"
	}),
	user_buid: one(users, {
		fields: [userBlocks.buid],
		references: [users.id],
		relationName: "userBlocks_buid_users_id"
	}),
}));

export const userChannelsRelations = relations(userChannels, ({one}) => ({
	user: one(users, {
		fields: [userChannels.uid],
		references: [users.id]
	}),
	channel: one(channels, {
		fields: [userChannels.cid],
		references: [channels.id]
	}),
}));

export const userIpsRelations = relations(userIps, ({one}) => ({
	ip: one(ips, {
		fields: [userIps.ip],
		references: [ips.ip]
	}),
	user: one(users, {
		fields: [userIps.uid],
		references: [users.id]
	}),
}));