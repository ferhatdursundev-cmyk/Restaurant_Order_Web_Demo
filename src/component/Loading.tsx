import { Box, Typography } from "@mui/material";

interface LoadingProps {
    message?: string;
    fullScreen?: boolean;
    minHeight?: number | string;
}

const DOT_COLORS = ["#FF7A00", "#FFB347", "#FFC87A"];

const BouncingDots = () => (
    <Box sx={{ display: "flex", gap: "10px", alignItems: "center", height: 36 }}>
        {DOT_COLORS.map((color, i) => (
            <Box
                key={i}
                sx={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    bgcolor: color,
                    "@keyframes pulse": {
                        "0%, 100%": { opacity: 0.25, transform: "scale(0.8)" },
                        "50%": { opacity: 1, transform: "scale(1.15)" },
                    },
                    animation: "pulse 1.2s ease-in-out infinite",
                    animationDelay: `${i * 0.2}s`,
                }}
            />
        ))}
    </Box>
);

export const Loading = ({
                            message = "Yükleniyor...",
                            fullScreen = false,
                            minHeight = 160,
                        }: LoadingProps) => {
    const inner = (
        <>
            <BouncingDots />
            {message && (
                <Typography
                    sx={{
                        fontSize: 15,
                        fontWeight: 700,
                        background: "linear-gradient(90deg, #FF7A00 0%, #FFB347 60%, #FFC87A 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        letterSpacing: 0.4,
                    }}
                >
                    {message}
                </Typography>
            )}
        </>
    );

    if (fullScreen) {
        return (
            <Box
                sx={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 9999,
                    bgcolor: "rgba(0,0,0,0.55)",
                    backdropFilter: "blur(2px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                }}
            >
                {inner}
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                borderRadius: 3,
                bgcolor: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(2px)",
                mx: 0.5,
            }}
        >
            {inner}
        </Box>
    );
};