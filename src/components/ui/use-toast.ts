import * as React from "react";

import { type ToastProps } from "@radix-ui/react-toast";

export type ToastActionElement = React.ReactNode;

interface Toast extends ToastProps {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
}

type ToasterToast = Toast;

const TOAST_LIMIT = 10;
const TOAST_REMOVE_DELAY = 1000;

const actionTypes = {
  ADD_TOAST: "ADD_TOAST" as const,
  UPDATE_TOAST: "UPDATE_TOAST" as const,
  DISMISS_TOAST: "DISMISS_TOAST" as const,
  REMOVE_TOAST: "REMOVE_TOAST" as const,
};

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

type State = {
  toasts: ToasterToast[];
};

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) return;

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: actionTypes.REMOVE_TOAST,
      toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
}

const toastReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((toast) =>
          toast.id === action.toast.id ? { ...toast, ...action.toast } : toast,
        ),
      };

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((toast) =>
          toast.id === toastId || toastId === undefined
            ? {
                ...toast,
                open: false,
              }
            : toast,
        ),
      };
    }

    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((toast) => toast.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = toastReducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    ...state,
    toast: ({ ...props }: Omit<ToasterToast, "id">) => {
      const id = genId();
      const update = (toast: Partial<ToasterToast>) => dispatch({ type: actionTypes.UPDATE_TOAST, toast: { ...toast, id } });
      const dismiss = () => dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });

      dispatch({
        type: actionTypes.ADD_TOAST,
        toast: {
          ...props,
          id,
        },
      });

      return {
        id,
        dismiss,
        update,
      };
    },
    dismiss: (toastId?: string) => dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  };
}

export { useToast, actionTypes, toastReducer, TOAST_LIMIT, type ToasterToast };
