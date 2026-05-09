import { create } from 'zustand';

type ConfirmModal = {
  kind: 'confirm';
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

type InputModal = {
  kind: 'input';
  title: string;
  description?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  validate?: (value: string) => string | null;
};

type DiffModal = {
  kind: 'diff';
  title: string;
  description?: string;
  path: string;
  language?: string;
  beforeText: string;
  afterText: string;
  confirmLabel?: string;
  destructive?: boolean;
};

type ModalPayload = ConfirmModal | InputModal | DiffModal;

type ModalState = {
  modal: ModalPayload | null;
  inputValue: string;
  inputError: string | null;
  resolver: ((value: boolean | string | null) => void) | null;
  requestConfirm: (payload: Omit<ConfirmModal, 'kind'>) => Promise<boolean>;
  requestInput: (payload: Omit<InputModal, 'kind'>) => Promise<string | null>;
  requestDiffConfirm: (payload: Omit<DiffModal, 'kind'>) => Promise<boolean>;
  setInputValue: (value: string) => void;
  submit: () => void;
  cancel: () => void;
};

export const useModalStore = create<ModalState>((set, get) => ({
  modal: null,
  inputValue: '',
  inputError: null,
  resolver: null,

  requestConfirm: async (payload) =>
    new Promise<boolean>((resolve) => {
      set({
        modal: {
          kind: 'confirm',
          ...payload
        },
        inputValue: '',
        inputError: null,
        resolver: (value) => resolve(Boolean(value))
      });
    }),

  requestInput: async (payload) =>
    new Promise<string | null>((resolve) => {
      set({
        modal: {
          kind: 'input',
          ...payload
        },
        inputValue: payload.initialValue ?? '',
        inputError: null,
        resolver: (value) => resolve(typeof value === 'string' ? value : null)
      });
    }),

  requestDiffConfirm: async (payload) =>
    new Promise<boolean>((resolve) => {
      set({
        modal: {
          kind: 'diff',
          ...payload
        },
        inputValue: '',
        inputError: null,
        resolver: (value) => resolve(Boolean(value))
      });
    }),

  setInputValue: (value) => {
    set({ inputValue: value, inputError: null });
  },

  submit: () => {
    const { modal, inputValue, resolver } = get();
    if (!modal || !resolver) {
      return;
    }

    if (modal.kind === 'confirm' || modal.kind === 'diff') {
      resolver(true);
      set({ modal: null, resolver: null, inputValue: '', inputError: null });
      return;
    }

    const value = inputValue.trim();
    if (!value) {
      set({ inputError: 'Value is required.' });
      return;
    }

    const validationError = modal.validate ? modal.validate(value) : null;
    if (validationError) {
      set({ inputError: validationError });
      return;
    }

    resolver(value);
    set({ modal: null, resolver: null, inputValue: '', inputError: null });
  },

  cancel: () => {
    const { resolver } = get();
    if (resolver) {
      resolver(false);
    }
    set({ modal: null, resolver: null, inputValue: '', inputError: null });
  }
}));
