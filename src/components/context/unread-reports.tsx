import React, { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { countReports } from "../../api/reports";
import { useSelector } from "react-redux";
import type { State } from "../../store/store";
import { MINUTE, USERLVL } from "../../core/constants";

const updateIntervalTime = 5 * MINUTE;

interface IUnreadReports {
  openReportsNumber: number;
  updateOpenReportsNumber: () => Promise<number | undefined>;
}

const UnreadReports = createContext<IUnreadReports | null>(null);

export const useUnreadReports = () => {
  const ctx = useContext(UnreadReports);
  if(!ctx) throw new Error('useUnreadReports outside provider');
  return ctx;
}

export const UnreadReportsProvider = ({ children }: PropsWithChildren) => {
  const userlvl = useSelector<State>((state) => state.user.userlvl) as State['user']['userlvl'];
  const [openReportsNumber, setOpenReportsNumber] = useState(0);
  
  const updateOpenReportsNumber = useCallback(async (options?: Pick<RequestInit, 'signal'>) => {
    try {
      const { count } = await countReports({
        status: 'open',
      }, options);
      setOpenReportsNumber(count);
      return count;
    } catch(e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if(+userlvl < USERLVL.JANNY) {
      return;
    }

    updateOpenReportsNumber();
    const intervalId = setInterval(() => updateOpenReportsNumber(), updateIntervalTime);
    return () => clearInterval(intervalId);
  }, [userlvl]);

  const value = useMemo(() => ({
    openReportsNumber,
    updateOpenReportsNumber,
  }), [openReportsNumber, updateOpenReportsNumber]);

  return (
    <UnreadReports.Provider value={value}>
      {children}
    </UnreadReports.Provider>
  )
}