/*
 * context for window to provide window-specific
 * state (args) and set stuff
 */
import { createContext, useContext } from 'react';

interface IWindowContext {
  args: Record<string, any>;
  params: Record<string, any>;
  setArgs: (args: Record<string, any>) => void;
  setTitle: (title: string) => void;
  changeType: (newType: string, newTitle: string, newArgs: Record<string, any>) => void;
}

const WindowContext = createContext<IWindowContext | null>(null);
/*
 * args are stored in state and they can be given by URI path
 * params are given by window.ssv.params on popup pages, they can be used to
 *   resolve some data server side and spare a request on the client, a window
 *   shall usually be able to work without them
 *
 * {
 *   args: object,
 *   setArgs: function,
 *   setTitle: function,
 *   changeType: function,
 *   params: object,
 * }
 */

export const useWindow = () => {
  const ctx = useContext(WindowContext);
  if(!ctx) {
    throw new Error('no WindowContext provider');
  }
  return ctx;
}

export default WindowContext;