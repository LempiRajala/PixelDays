import React, { memo, PropsWithChildren, useCallback, useEffect, useState } from "react";
import { searchReports, updateReport, type SearchReportsResponse } from "../api/reports";
import type { SearchReportsQuerySchema } from "../api-contracts";
import debounce from 'lodash/debounce';
import { makeReportCategoryUserFriendly, makeReportStatusUserFriendly } from "../db/shared";
import { ReportCategorySelect } from "./report-category-select";
import { ReportStatusSelect } from "./report-status-select";
import { t } from "ttag";
import type { ReportCategories, ReportStatuses } from "../db/schema";
import { TelegramLink } from "./telegram-link";
import { SmallAvatar } from "./small-avatar";
import { IoSearch } from "react-icons/io5";
import { Badge } from "./badge";
import { useUnreadReports } from "./context/unread-reports";

const reportsPerPage = 20;

const Reports = memo(() => {
  const { updateOpenReportsNumber } = useUnreadReports();
  const [searchResult, setSearchResult] = useState<SearchReportsResponse | null>(null);
  const [textQuery, setTextQuery] = useState('');
  const [category, setCategory] = useState<SearchReportsQuerySchema['category']>();
  const [status, setStatus] = useState<SearchReportsQuerySchema['status']>('open');
  const [page, setPage] = useState(0);

  const makeSearch = useCallback((searchParams: Omit<SearchReportsQuerySchema, 'limit'>) => {
    const controller = new AbortController();

    searchReports({
      ...searchParams,
      limit: reportsPerPage,
    }, controller)
      .then(setSearchResult)
      .catch(e => console.error(e));

    return controller;
  }, []);

  const makeDebouncedSearch = useCallback(debounce(makeSearch, 333), [makeSearch]);

  const changeReportStatus = async (id: string, status: ReportStatuses) => {
    await updateReport(id, { status });
    setSearchResult(list => {
      if(!list) return null;

      const updatedReportIndex = list.findIndex(report => report.id === id);
      if(updatedReportIndex === -1) return list.slice();

      return list.toSpliced(updatedReportIndex, 1, {
        ...list[updatedReportIndex],
        status,
      })
    });
    await updateOpenReportsNumber();
  }

  const onChangeCategoryFilter = (category?: ReportCategories) => {
    setCategory(category);
    setPage(0);
    makeSearch({
      offset: 0,
      category,
      status,
      text: textQuery,
    });
  }

  const onChangeStatusFilter = (status?: ReportStatuses) => {
    setStatus(status);
    setPage(0);
    makeSearch({
      offset: 0,
      category,
      status,
      text: textQuery,
    });
  }

  const onChangeTextFilter = (text: string) => {
    setTextQuery(text);
    setPage(0);
    makeDebouncedSearch({
      offset: 0,
      category,
      status,
      text,
    });
  }

  const prevPageAvailable = !!searchResult && page > 0;
  const nextPageAvailable = !!searchResult && searchResult.length === reportsPerPage;

  const onPrevPage = () => {
    if(!prevPageAvailable) return;
    const newPageValue = page - 1;
    setPage(newPageValue);
    makeSearch({
      offset: newPageValue * reportsPerPage,
      category,
      status,
      text: textQuery,
    });
  }

  const onNextPage = () => {
    console.log('nextPageAvailable',nextPageAvailable)
    if(!nextPageAvailable) return;
    const newPageValue = page + 1;
    setPage(newPageValue);
    makeSearch({
      offset: newPageValue * reportsPerPage,
      category,
      status,
      text: textQuery,
    });
  }

  useEffect(() => {
    const controller = makeDebouncedSearch({
      category,
      status,
      offset: 0,
    });
    return () => controller?.abort();
  }, []);

  return (
    <div style={{
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      <div style={{
        marginBottom: '16px',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '4px',
          alignItems: 'center',
          marginBottom: '4px',
        }}>
          <IoSearch size={18} />
          <input
            value={textQuery}
            onChange={e => onChangeTextFilter(e.target.value)}
            style={{
              outline: 'none',
              width: '80%',
            }}
          />
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '8px',
        }}>
          <FilterField>
            <div style={{ textAlign: 'start' }}>{t`Category`}</div>
            <ReportCategorySelect
              allowUnset
              value={category}
              onChange={value => void onChangeCategoryFilter(value)}
            />
          </FilterField>
          <FilterField>
            <div style={{ textAlign: 'start' }}>{t`Status`}</div>
            <ReportStatusSelect
              allowUnset
              value={status}
              onChange={value => void onChangeStatusFilter(value)}
            />
          </FilterField>
        </div>
      </div>
      <div style={{
        overflow: 'hidden',
        width: '100%',
      }}>
        <Pagination
          page={page + 1}
          nextAvailable={nextPageAvailable}
          prevAvailable={prevPageAvailable}
          onNext={onNextPage}
          onPrev={onPrevPage}
        />
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          overflow: 'scroll',
          width: '100%',
          height: 'max-content',
        }}>
          { searchResult === null &&
            <div>{t`Loading...`}</div>
          }
          { searchResult && searchResult.length === 0 &&
            <div>{t`No results`}</div>
          }
          { searchResult && searchResult.length > 0 &&
            searchResult.map(report => (
              <ReportRecord
                key={report.id}
                report={report}
                onChangeStatus={status => changeReportStatus(report.id, status)}
              />
            ))
          }
        </div>
        <Pagination
          page={page + 1}
          nextAvailable={nextPageAvailable}
          prevAvailable={prevPageAvailable}
          onNext={onNextPage}
          onPrev={onPrevPage}
        />
      </div>
    </div>
  )
});

Reports.displayName = 'Reports';

export default Reports;

function FilterField({ children }: PropsWithChildren) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      {children}
    </div>
  )
}

function ReportRecord({
  report,
  onChangeStatus,
}: {
  report: SearchReportsResponse[number];
  onChangeStatus: (status: ReportStatuses) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div style={{
      borderBottom: '1px solid gray',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      paddingBottom: '8px',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}>
        <div style={{ textAlign: 'start' }}>
          <h3 style={{
            margin: 0,
            paddingBottom: '4px',
            display: 'inline',
          }}>
            {report.title}
          </h3>
          <Badge backgroundColor="rgb(43, 131, 255)">
            {makeReportCategoryUserFriendly(report.category)}
          </Badge>
          <Badge backgroundColor={
            report.status === 'open' ? 'springgreen' :
            report.status === 'rejected' ? 'gray' :
            'darkred'
          }>
            {makeReportStatusUserFriendly(report.status)}
          </Badge>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '4px',
        }}>
          <SmallAvatar avatarId={report.user.avatarId}/>
          <span style={{ transform: 'translate(0,7px)' }}>
            {report.user.username} ({report.createdBy})
          </span>
          <span style={{
            fontSize: '10px',
            fontFamily: 'monospace',
            opacity: '0.85',
            transform: 'translate(0,10px)',
          }}>
            {formatDate(report.createdAt)}
          </span>
        </div>
      </div>
      
      { expanded &&
        <div style={{
          paddingLeft: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          { report.telegram && report.telegram.trim().length > 0 &&
            <div style={{ textAlign: 'start' }}>
              {t`Telegram`}{": "}
              <TelegramLink
                username={report.telegram}
                style={{ cursor: 'pointer' }}
              />
            </div>
          }
          { report.discord && report.discord.trim().length > 0 &&
            <div style={{ textAlign: 'start' }}>
              {t`Discord`}{": "}
              <span>
                {report.discord}
              </span>
            </div>
          }
          <div style={{
            textAlign: 'start',
          }}>
            <div>{t`Report text`}: </div>
            <div style={{
              paddingLeft: '8px',
              whiteSpace: 'pre-wrap',
            }}>
              {report.text}
            </div>
          </div>
        </div>
      }

      <div style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingLeft: '16px',
      }}>
          <button
            style={{
              cursor: 'pointer',
              width: 'fit-content',
              borderWidth: 0,
              background: 'transparent',
              color: 'blue',
              textDecoration: 'underline',
            }}
            onClick={() => setExpanded(!expanded)}
          >
            {
              expanded
              ? t`Show less`
              : t`Show more`
            }
          </button>
          <div>
            <button
              disabled={report.status === 'rejected'}
              style={{
                cursor: 'pointer',
                color: 'red',
                marginRight: '8px',
              }}
              onClick={() => onChangeStatus('rejected')}
            >
              {t`Reject report`}
            </button>
            <button
              disabled={report.status === 'closed'}
              style={{
                cursor: 'pointer',
                color: 'green',
              }}
              onClick={() => onChangeStatus('closed')}
            >
              {t`Close report`}
            </button>
          </div>
      </div>
    </div>
  )
}

function Pagination({
  page,
  prevAvailable,
  nextAvailable,
  onPrev,
  onNext,
}: {
  page: number;
  prevAvailable: boolean;
  nextAvailable: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <button
        role="button"
        style={{
          cursor: prevAvailable ? 'pointer' : 'not-allowed',
          background: 'transparent',
          borderTop: '2px solid black',
          borderRight: '2px solid black',
          borderBottom: 'none',
          borderLeft: 'none',
          width: '10px',
          height: '10px',
          padding: 0,
          transform: 'rotate(-135deg)',
          opacity: prevAvailable ? '1' : '0.5',
        }}
        disabled={!prevAvailable}
        onClick={onPrev}
      >
      </button>
      <div style={{
        padding: '8px',
        fontFamily: 'monospace',
      }}>
        {page}
      </div>
      <button
        role="button"
        style={{
          cursor: nextAvailable ? 'pointer' : 'not-allowed',
          background: 'transparent',
          borderTop: '2px solid black',
          borderRight: '2px solid black',
          borderBottom: 'none',
          borderLeft: 'none',
          width: '10px',
          height: '10px',
          padding: 0,
          transform: 'rotate(45deg)',
          opacity: nextAvailable ? '1' : '0.5',
        }}
        disabled={!nextAvailable}
        onClick={onNext}
      />
    </div>
  )
}

function formatDate(date: Date) {
  const iso = date.toISOString();
  return iso.substring(0, iso.indexOf('.')).replaceAll('-', '.').replaceAll('T', ' ');
}