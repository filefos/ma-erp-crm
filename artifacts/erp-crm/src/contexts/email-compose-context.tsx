import { createContext, useContext, useState, type ReactNode } from "react";

export interface EmailAttachment {
  filename: string;
  content: string;
  contentType: string;
  size: number;
}

export interface EmailComposeOptions {
  toAddress?: string;
  toName?: string;
  ccAddress?: string;
  subject?: string;
  body?: string;
  attachments?: EmailAttachment[];
  clientName?: string;
  sourceRef?: string;
  companyId?: number;
}

interface EmailComposeContextValue {
  isOpen: boolean;
  options: EmailComposeOptions;
  openCompose: (opts?: EmailComposeOptions) => void;
  closeCompose: () => void;
}

const EmailComposeContext = createContext<EmailComposeContextValue | null>(null);

export function EmailComposeProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<EmailComposeOptions>({});

  const openCompose = (opts: EmailComposeOptions = {}) => {
    setOptions(opts);
    setIsOpen(true);
  };

  const closeCompose = () => {
    setIsOpen(false);
    setOptions({});
  };

  return (
    <EmailComposeContext.Provider value={{ isOpen, options, openCompose, closeCompose }}>
      {children}
    </EmailComposeContext.Provider>
  );
}

export function useEmailCompose() {
  const ctx = useContext(EmailComposeContext);
  if (!ctx) throw new Error("useEmailCompose must be used within EmailComposeProvider");
  return ctx;
}
