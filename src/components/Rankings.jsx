/*
 * Rankings Tabs
 */

/* eslint-disable max-len */

import React, { useState, useMemo } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { t } from 'ttag';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  ArcElement,
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';
import { cdn } from '../utils/utag.js';

import { numberToString, numberToStringFull } from '../core/utils.js';
import { selectIsDarkMode } from '../store/selectors/gui.ts';
import { selectStats } from '../store/selectors/ranks.js';
import {
  getCHistChartOpts,
  getCHistChartData,
  getOnlineStatsOpts,
  getOnlineStatsData,
  getHistChartOpts,
  getHistChartData,
  getCPieOpts,
  getCPieData,
  getPDailyStatsOpts,
  getPDailyStatsData,
} from '../core/chartSettings.js';
import CooldownChanges from './CooldownChanges.jsx';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  // for pie chart
  ArcElement,
);

const Rankings = () => {
  const [area, setArea] = useState('total');
  const [
    totalRanking,
    totalDailyRanking,
    dailyCRanking,
    prevTop,
    onlineStats,
    cHistStats,
    cHourlyStats,
    histStats,
    pDailyStats,
    pHourlyStats,
  ] = useSelector(selectStats, shallowEqual);
  const isDarkMode = useSelector(selectIsDarkMode);

  const cHistData = useMemo(() => {
    if (area !== 'charts') {
      return null;
    }
    return getCHistChartData(cHistStats);
  }, [area, cHistStats]);

  const cHistOpts = useMemo(() => {
    if (area !== 'charts') {
      return null;
    }
    return getCHistChartOpts(isDarkMode);
  }, [area, isDarkMode]);

  const onlineData = useMemo(() => {
    if (area !== 'charts') {
      return null;
    }
    return getOnlineStatsData(onlineStats, pHourlyStats);
  }, [area, onlineStats, pHourlyStats]);

  const onlineOpts = useMemo(() => {
    if (area !== 'charts') {
      return null;
    }
    return getOnlineStatsOpts(isDarkMode);
  }, [area, isDarkMode]);

  const histData = useMemo(() => {
    if (area !== 'charts') {
      return null;
    }
    return getHistChartData(histStats);
  }, [area, histStats]);

  const histOpts = useMemo(() => {
    if (area !== 'charts') {
      return null;
    }
    return getHistChartOpts(isDarkMode);
  }, [area, isDarkMode]);

  const pDailyData = useMemo(() => {
    if (area !== 'charts') {
      return null;
    }
    return getPDailyStatsData(pDailyStats);
  }, [area, pDailyStats]);

  const pDailyOpts = useMemo(() => {
    if (area !== 'charts') {
      return null;
    }
    return getPDailyStatsOpts(isDarkMode);
  }, [area, isDarkMode]);

  const cPieData = useMemo(() => {
    if (area !== 'countries') {
      return null;
    }
    return getCPieData(dailyCRanking);
  }, [area, dailyCRanking]);

  const cPieOpts = useMemo(() => {
    if (area !== 'countries') {
      return null;
    }
    return getCPieOpts();
  }, [area]);

  return (
    <>
      <div className="content">
        <span
          role="button"
          tabIndex={-1}
          className={
            (area === 'total') ? 'modallink selected' : 'modallink'
          }
          onClick={() => setArea('total')}
        > {t`Total`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={-1}
          className={
            (area === 'today') ? 'modallink selected' : 'modallink'
          }
          onClick={() => setArea('today')}
        > {t`Today`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={-1}
          className={
            (area === 'yesterday') ? 'modallink selected' : 'modallink'
          }
          onClick={() => setArea('yesterday')}
        > {t`Yesterday`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={-1}
          className={
            (area === 'countries') ? 'modallink selected' : 'modallink'
          }
          onClick={() => setArea('countries')}
        > {t`Countries Today`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={-1}
          className={
            (area === 'charts') ? 'modallink selected' : 'modallink'
          }
          onClick={() => setArea('charts')}
        > {t`Charts`}</span>
      </div>
      <br />
      {(() => {
        switch (area) {
          case 'total': return <h3>{t`Total Pixels per Player`}</h3>;
          case 'today': return <h3>{t`Daily Pixels per Player`}</h3>;
          case 'yesterday': return <h3>{t`Top 10 Players from Yesterday`}</h3>;
          case 'countries': return (
            <>
              <CooldownChanges />
              <h3>{t`Daily Pixels per Country`}</h3>
              <div style={{ height: 300, paddingBottom: 16 }}>
                <Pie options={cPieOpts} data={cPieData} />
              </div>
            </>
          );
          case 'charts': return <h3>{t`Charts`}</h3>;
          default: return null;
        }
      })()}
      {(['total', 'today', 'yesterday', 'countries'].includes(area)) && (
        <table style={{ display: 'inline' }}>
          <thead>
            {(() => {
              switch (area) {
                case 'total': return (
                  <tr>
                    <th>#</th>
                    <th>{t`User`}</th>
                    <th>Pixels</th>
                    <th># Today</th>
                    <th>Pixels Today</th>
                  </tr>
                );
                case 'today': return (
                  <tr>
                    <th>#</th>
                    <th>{t`User`}</th>
                    <th>Pixels</th>
                    <th># Total</th>
                    <th>Total Pixels</th>
                  </tr>
                );
                case 'yesterday': return (
                  <tr>
                    <th>#</th>
                    <th>{t`User`}</th>
                    <th>Pixels</th>
                  </tr>
                );
                case 'countries': return (
                  <tr>
                    <th>#</th>
                    <th>{t`Country`}</th>
                    <th>
                      Pixels&nbsp;
                      <span className="c-last-hour">{t`+last hour`}</span>
                    </th>
                  </tr>
                );
                default: return null;
              }
            })()}
          </thead>
          <tbody>
            {(() => {
              switch (area) {
                case 'total': return totalRanking.map((rank) => (
                  <tr key={rank.name}>
                    <td>{rank.r}</td>
                    <td><span>{rank.name}</span></td>
                    <td className="c-num">{numberToStringFull(rank.t, '')}</td>
                    <td>{rank.dr}</td>
                    <td className="c-num">{numberToStringFull(rank.dt, '')}</td>
                  </tr>
                ));
                case 'today': return totalDailyRanking.map((rank) => (
                  <tr key={rank.name}>
                    <td>{rank.dr}</td>
                    <td><span>{rank.name}</span></td>
                    <td className="c-num">{numberToStringFull(rank.dt, '')}</td>
                    <td>{rank.r}</td>
                    <td className="c-num">{numberToStringFull(rank.t, '')}</td>
                  </tr>
                ));
                case 'yesterday': return prevTop.map((rank, ind) => (
                  <tr key={rank.name}>
                    <td>{ind + 1}</td>
                    <td><span>{rank.name}</span></td>
                    <td className="c-num">{numberToStringFull(rank.px, '')}</td>
                  </tr>
                ));
                case 'countries': return dailyCRanking.map((rank, ind) => (
                  <tr key={rank.name}>
                    <td>{ind + 1}</td>
                    <td
                      title={rank.cc}
                      className="tab-cc-cell"
                    ><img
                      alt={rank.cc}
                      src={cdn`/cf/${rank.cc}.gif`}
                    /></td>
                    <td className="c-num">
                      {numberToStringFull(rank.px)}
                      {(cHourlyStats[rank.cc] > 0) && (
                        <span className="c-last-hour">
                          &nbsp;+{numberToString(cHourlyStats[rank.cc])}
                        </span>
                      )}
                    </td>
                  </tr>
                ));
                default: return null;
              }
            })()}
          </tbody>
        </table>
      )}
      {(area === 'charts') && (
        <>
          <Line options={cHistOpts} data={cHistData} />
          <Line options={onlineOpts} data={onlineData} />
          <Line options={pDailyOpts} data={pDailyData} />
          <Line options={histOpts} data={histData} />
        </>
      )}
      <p>
        {t`Ranking updates every 5 min. Daily rankings get reset at midnight UTC.`}
      </p>
    </>
  );
};

export default React.memo(Rankings);
