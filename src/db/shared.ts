import { t } from 'ttag';
import type { Report } from './schema';

export const reportCategories = [
	'bug',
	'bot',
	'proxy',
	'moder-or-admin-abuse',
	'add-to-whitelist',
	'other',
] as const;

export const reportStatuses = [
	'open',
	'closed',
	'rejected',
] as const;

export const makeReportCategoryUserFriendly = (category: Report['category']): string => {
	if(category === 'bot') return t`Bot`;
	if(category === 'moder-or-admin-abuse') return t`Admin abuse`;
	if(category === 'bug') return t`Bug`;
	if(category === 'proxy') return t`Proxy`;
	if(category === 'other') return t`Other`;
	if(category === 'add-to-whitelist') return t`Add to whitelist`;

	console.warn(`unrecognized report category "${category}"`);
	return category;
}

export const makeReportStatusUserFriendly = (status: Report['status']): string => {
	if(status === 'open') return t`Open`;
	if(status === 'closed') return t`Closed`;
	if(status === 'rejected') return t`Rejected`;

	console.warn(`unrecognized report status "${status}"`);
	return status;
}