import React, { useCallback } from "react";
import { Box, LinearProgress, Typography } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";

const ACCEPT_TYPES = "image/jpeg,image/png,image/webp";
const MAX_SIZE_MB  = 5;

type Props = {
    preview: string | null;
    uploadProgress: number | null;
    disabled?: boolean;
    onFile: (file: File) => void;
};

export const ImageUploadField = ({ preview, uploadProgress, disabled = false, onFile }: Props) => {
    const [isDragging, setIsDragging] = React.useState(false);

    const applyFile = useCallback((file: File) => {
        if (!file.type.startsWith("image/")) return;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) return;
        onFile(file);
    }, [onFile]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) applyFile(file);
        e.target.value = "";
    }, [applyFile]);

    const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback(() => setIsDragging(false), []);
    const handleDrop      = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) applyFile(file);
    }, [applyFile]);

    return (
        <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1, color: "text.secondary" }}>
                Ürün Resmi
            </Typography>

            <Box
                component="label"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    border: "2px dashed",
                    borderColor: isDragging ? "primary.main" : "divider",
                    borderRadius: 3,
                    p: 2,
                    cursor: disabled ? "not-allowed" : "pointer",
                    bgcolor: isDragging ? "action.hover" : "transparent",
                    transition: "all 150ms ease",
                    position: "relative",
                    overflow: "hidden",
                    minHeight: 130,
                }}
            >
                <input type="file" accept={ACCEPT_TYPES} hidden disabled={disabled} onChange={handleFileInput} />

                {preview ? (
                    <Box
                        component="img"
                        src={preview}
                        sx={{
                            width: "100%",
                            maxHeight: 170,
                            objectFit: "cover",
                            borderRadius: 2,
                            opacity: isDragging ? 0.5 : 1,
                            transition: "opacity 150ms",
                        }}
                    />
                ) : (
                    <>
                        <UploadFileIcon sx={{ fontSize: 34, color: "text.disabled" }} />
                        <Typography sx={{ fontSize: 13, color: "text.secondary", textAlign: "center" }}>
                            Sürükle bırak veya tıkla
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
                            JPG, PNG, WEBP — maks {MAX_SIZE_MB}MB
                        </Typography>
                    </>
                )}

                {isDragging && (
                    <Box sx={{
                        position: "absolute", inset: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        bgcolor: "rgba(0,0,0,0.35)", borderRadius: 3,
                    }}>
                        <Typography sx={{ color: "white", fontWeight: 800 }}>Bırak!</Typography>
                    </Box>
                )}
            </Box>

            {uploadProgress !== null && (
                <Box sx={{ mt: 1 }}>
                    <LinearProgress variant="determinate" value={uploadProgress} sx={{ borderRadius: 999 }} />
                    <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 0.5 }}>
                        {uploadProgress < 100 ? `Yükleniyor... %${uploadProgress}` : "Tamamlandı"}
                    </Typography>
                </Box>
            )}
        </Box>
    );
};