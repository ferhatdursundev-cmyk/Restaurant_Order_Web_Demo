import {Box, Typography} from "@mui/material";


export const Footer = () => {
    return (
        <Box
            component="footer"
            sx={{
                zIndex: 1200,
                bgcolor: "background.default",
                borderTop: "1px solid",
                borderColor: "divider",
                py: 1,
                px: 2,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    flexWrap: "wrap",
                }}
            >
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                    Pruvasoftware © {new Date().getFullYear()} RESTORAN-KAFE-OTEL
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                    Tüm hakları saklıdır.
                </Typography>
            </Box>
        </Box>
    );
}