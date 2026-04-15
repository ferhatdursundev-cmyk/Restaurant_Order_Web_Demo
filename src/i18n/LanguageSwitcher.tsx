import { useState } from "react";
import { Popover, Tooltip, ButtonBase } from "@mui/material";
import { LANGUAGES, useLanguage, type Lang } from "./useLanguage";

interface Props {
    size?: "compact" | "normal";
}

export const LanguageSwitcher = ({ size = "normal" }: Props) => {
    const { lang, setLang } = useLanguage();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    const btnSize = size === "compact" ? 28 : 34;
    const fontSize = size === "compact" ? 17 : 20;

    const active = LANGUAGES.find((l) => l.code === lang)!;
    const others = LANGUAGES.filter((l) => l.code !== lang);
    const open = Boolean(anchorEl);

    return (
        <>
            {/* Sadece aktif dil bayrağı görünür */}
            <Tooltip title={active.label} placement="bottom" arrow>
                <ButtonBase
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                    sx={{
                        width: btnSize,
                        height: btnSize,
                        borderRadius: 999,
                        fontSize,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "rgba(0,0,0,0.06)",
                        border: "1px solid",
                        borderColor: "divider",
                        transition: "all 150ms ease",
                        "&:hover": {
                            bgcolor: "rgba(0,0,0,0.10)",
                            transform: "scale(1.08)",
                        },
                    }}
                    aria-label={active.label}
                    aria-haspopup="true"
                    aria-expanded={open}
                >
                    {active.flag}
                </ButtonBase>
            </Tooltip>

            {/* Tıklayınca diğer diller açılır */}
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                transformOrigin={{ vertical: "top", horizontal: "center" }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 0.75,
                            borderRadius: 999,
                            px: 0.5,
                            py: 0.5,
                            display: "flex",
                            gap: 0.4,
                            boxShadow: "0 8px 30px rgba(0,0,0,0.14)",
                            border: "1px solid",
                            borderColor: "divider",
                            bgcolor: "background.paper",
                        },
                    },
                }}
            >
                {others.map(({ code, label, flag }) => (
                    <Tooltip key={code} title={label} placement="bottom" arrow>
                        <ButtonBase
                            onClick={() => {
                                setLang(code as Lang);
                                setAnchorEl(null);
                            }}
                            sx={{
                                width: btnSize,
                                height: btnSize,
                                borderRadius: 999,
                                fontSize,
                                display: "grid",
                                placeItems: "center",
                                transition: "all 150ms ease",
                                "&:hover": {
                                    bgcolor: "rgba(0,0,0,0.07)",
                                    transform: "scale(1.12)",
                                },
                            }}
                            aria-label={label}
                        >
                            {flag}
                        </ButtonBase>
                    </Tooltip>
                ))}
            </Popover>
        </>
    );
};