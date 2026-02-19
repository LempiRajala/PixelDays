import express from 'express';

import { requireOidc } from '../../middleware/oidc.js';
import logger from '../../core/logger.js';
import { findUserById } from '../../data/sql/User.js';
import { USERLVL } from '../../data/sql/index.js';
import { countReports, countReportsForLastTime, createReport, getReport, searchReports, updateReport } from '../../db/utils/reports.ts';
import { baseReportSearchQuery, createReportSchema, searchReportsQuerySchema, updateReportSchema } from '../../api-contracts.ts';
import { DAY, maxReportsPerDay } from "../../core/constants";

const router = express.Router();

// @ts-expect-error
router.use(requireOidc('reports', true));

router.post('/', express.json(), async (req, res) => {
  // @ts-expect-error
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).send();
  }

  const reportsInLastDay = await countReportsForLastTime({
    userId,
    timePeriod: DAY,
  });
  if (reportsInLastDay >= maxReportsPerDay) {
    // @ts-expect-error
    const { t } = req.ttag;
    return res.status(429).send(t`You can only send ${maxReportsPerDay} reports per day.`);
  }

  const { data, error } = await createReportSchema.safeParseAsync(req.body);
  if (error) {
    return res.status(400).send(error);
  }

  const created = await createReport({
    createdBy: userId,
    ...data,
  });

  return res.status(201).send(created);
});

/*
 * make sure User is logged in and at least Mod
 */
router.use(async (req, res, next) => {
  /*
   * special case for oauth, this user object has only a subset of values
   */
  // @ts-expect-error
  if (!req.user && req.oidcUserId) {
    // @ts-expect-error
    req.user = await findUserById(req.oidcUserId);
  }

  // @ts-expect-error
  if (!req.user) {
    // @ts-expect-error
    const { t } = req.ttag;
    next(new Error(t`You are not logged in`));
    return;
  }
  // @ts-expect-error
  const { userlvl } = req.user;
  if (!userlvl || userlvl < USERLVL.JANNY) {
    // @ts-expect-error
    const { t } = req.ttag;
    next(new Error(t`You are not allowed to access this page`));
    return;
  }

  if (!req.body?.cleanerstat) {
    // logger.info(
    //   `MODTOOLS> access ${req.user.name}[${req.user.id}] -  ${req.ip.ipString}`,
    // );
  }
  next();
});

router.get('/search', async (req, res) => {
  const { data, error } = await searchReportsQuerySchema.safeParseAsync(req.query);
  if (error) {
    return res.status(400).send(error);
  }

  const results = await searchReports({
    // @ts-expect-error
    excludeModOrAdminAbuse: req.user.userlvl < USERLVL.ADMIN,
    ...data,
  });
  return res.status(200).send(results);
});

router.get('/count', async (req, res) => {
  const { data, error } = await baseReportSearchQuery.safeParseAsync(req.query);
  if (error) {
    return res.status(400).send(error);
  }

  const count = await countReports({
    // @ts-expect-error
    excludeModOrAdminAbuse: req.user.userlvl < USERLVL.ADMIN,
    ...data,
  });
  return res.status(200).send({ count });
});

router.get('/:id', async (req, res) => {
  const reportId = req.params.id;
  const report = await getReport(reportId);
  if (!report) {
    return res.status(404).send();
  }

  return res.status(200).send(report);
});

router.post('/:id', express.json(), async (req, res) => {
  const reportId = req.params.id;

  const report = await getReport(reportId);
  if (!report) {
    return res.status(404).send();
  }

  // @ts-expect-error
  if(report.category === 'moder-or-admin-abuse' && req.user.userlvl < USERLVL.ADMIN) {
    // @ts-expect-error
    const { t } = req.ttag;
    return res.status(403).send(t`You cannot edit report on moder abuse`);
  }
  
  const { data, error } = await updateReportSchema.safeParseAsync(req.body);
  if (error) {
    return res.status(400).send(error);
  }

  await updateReport(reportId, data);
  
  return res.status(200).send();
});

/*
 * just mods + admins past here, no Jannies
 */
router.use(async (req, res, next) => {
  // @ts-expect-error
  if (req.user.userlvl < USERLVL.MOD) {
    // @ts-expect-error
    const { t } = req.ttag;
    res.status(403).send(t`Just admins can do that`);
    return;
  }
  next();
});

/*
 * just admins past here, no Mods
 */
router.use(async (req, res, next) => {
  // @ts-expect-error
  if (req.user.userlvl < USERLVL.ADMIN) {
    // @ts-expect-error
    const { t } = req.ttag;
    res.status(403).send(t`Just admins can do that`);
    return;
  }
  next();
});

router.use(async (req, res, next) => {
  next(new Error('Invalid request'));
});

// @ts-expect-error
router.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(400).send(err.message);
  logger.error(
    // eslint-disable-next-line max-len
    `REPORTS> ${req.ip.ipString} / ${req.user.id} encountered error on using reports: ${err.message}`,
  );
});

export default router;