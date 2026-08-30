import {
  createContext,
  useContext,
  useMemo,
  type ComponentType,
  type InputHTMLAttributes,
  type PropsWithChildren,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import {
  BottomSheet,
  KeyboardInput,
  MobileScroll,
  useKeyboard,
  useKeyboardInsets,
} from "../mobile";

export type ShellSheetProps = PropsWithChildren<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
}>;

export type ShellScrollProps = PropsWithChildren<{ className?: string }>;
export type ShellFieldProps = InputHTMLAttributes<HTMLInputElement>;

type ShellValue = {
  /** "device" renders inside the iPhone/Pixel prototype frame, "web" renders frameless and responsive. */
  mode: "device" | "web";
  isKeyboardVisible: boolean;
  hideKeyboard: () => void;
  Scroll: ComponentType<ShellScrollProps>;
  Sheet: ComponentType<ShellSheetProps>;
  Field: ComponentType<ShellFieldProps>;
};

const ShellContext = createContext<ShellValue | null>(null);

export function useShell() {
  const context = useContext(ShellContext);

  if (!context) {
    throw new Error("useShell must be used inside DeviceShell or WebShell");
  }

  return context;
}

/* ---------------------------------------------------------------- device */

/** Shell for the prototype runtime: real momentum scrolling, simulated keyboard, phone bottom sheet. */
export function DeviceShell({ children }: PropsWithChildren) {
  const keyboard = useKeyboard();
  const { isKeyboardVisible } = useKeyboardInsets();

  const value = useMemo<ShellValue>(
    () => ({
      mode: "device",
      isKeyboardVisible,
      hideKeyboard: () => keyboard.hide(),
      Scroll: MobileScroll,
      Sheet: BottomSheet,
      Field: KeyboardInput,
    }),
    [isKeyboardVisible, keyboard],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

/* ------------------------------------------------------------------- web */

function WebScroll({ className, children }: ShellScrollProps) {
  return <div className={`web-scroll${className ? ` ${className}` : ""}`}>{children}</div>;
}

function WebField(props: ShellFieldProps) {
  return <input {...props} />;
}

function WebSheet({ open, onOpenChange, title, description, children }: ShellSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="web-sheet-overlay" />
        <Dialog.Content className="web-sheet" aria-describedby={description ? undefined : "web-sheet-title"}>
          <span className="web-sheet-grabber" aria-hidden="true" />
          <Dialog.Close className="web-sheet-close" aria-label="Cerrar">
            <Cross2Icon />
          </Dialog.Close>
          <Dialog.Title className="web-sheet-title" id="web-sheet-title">
            {title}
          </Dialog.Title>
          {description ? (
            <Dialog.Description className="web-sheet-description">{description}</Dialog.Description>
          ) : null}
          <div className="web-sheet-content">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Shell for the real responsive app: native scrolling, native keyboard, responsive dialog. */
export function WebShell({ children }: PropsWithChildren) {
  const value = useMemo<ShellValue>(
    () => ({
      mode: "web",
      isKeyboardVisible: false,
      hideKeyboard: () => {},
      Scroll: WebScroll,
      Sheet: WebSheet,
      Field: WebField,
    }),
    [],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}
