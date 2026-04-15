import { type ReactNode } from "react";
import {Dialog, DialogActions, DialogContent, DialogTitle, Button, Typography} from "@mui/material";

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
}) => {
    const hasContent = Boolean(description) || Boolean(children);

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
            <DialogTitle>{title}</DialogTitle>

            {hasContent ? (
                <DialogContent>
                    {description ? (
                        <Typography sx={{ color: "text.secondary" }}>{description}</Typography>
                    ) : null}
                    {children}
                </DialogContent>
            ) : null}

            <DialogActions>
                <Button color="error" variant="contained" onClick={onConfirm} disabled={busy || confirmDisabled} >
                    {confirmText}
                </Button>
                <Button onClick={onClose} disabled={busy}>
                    {cancelText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};