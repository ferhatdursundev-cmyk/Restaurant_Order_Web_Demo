import { type ReactNode } from "react";
import { Dialog, DialogActions, DialogContent, DialogTitle, Button, Typography } from "@mui/material";

export const ConfirmDialog = ({
                                  open,
                                  title,
                                  confirmDisabled = false,
                                  description,
                                  children,
                                  confirmText = "Onayla",
                                  cancelText = "İptal",
                                  onClose,
                                  onConfirm,
                                  busy = false,
                                  maxWidth = "xs",
                                  maxHeight = "80vh",
                              }: {
    open: boolean;
    title: ReactNode;
    confirmDisabled?: boolean;
    description?: string;
    children?: ReactNode;
    confirmText?: string;
    cancelText?: string;
    onClose: () => void;
    onConfirm: () => void;
    busy?: boolean;
    maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
    maxHeight?: string | number;
}) => {
    const hasContent = Boolean(description) || Boolean(children);

    return (
        <Dialog
            open={open}
            onClose={busy ? undefined : onClose}
            fullWidth
            maxWidth={maxWidth}
            PaperProps={{ sx: { maxHeight, display: "flex", flexDirection: "column" } }}
        >
            <DialogTitle sx={{ flexShrink: 0 }}>{title}</DialogTitle>

            {hasContent ? (
                <DialogContent sx={{ overflowY: "auto", flex: 1 }}>
                    {description ? (
                        <Typography sx={{ color: "text.secondary" }}>{description}</Typography>
                    ) : null}
                    {children}
                </DialogContent>
            ) : null}

            <DialogActions sx={{ flexShrink: 0 }}>
                <Button color="error" variant="contained" onClick={onConfirm} disabled={busy || confirmDisabled}>
                    {confirmText}
                </Button>
                <Button onClick={onClose} disabled={busy}>
                    {cancelText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};