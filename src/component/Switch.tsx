import { Switch, type SwitchProps } from "@mui/material";

const premiumSwitchSx = {
    "& .MuiSwitch-switchBase.Mui-checked": {
        color: "#FF7A00",
        "&:hover": { backgroundColor: "rgba(255,122,0,0.12)" },
    },
    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
        backgroundColor: "#FF7A00",
        opacity: 1,
    },
    "& .MuiSwitch-track": {
        backgroundColor: "rgba(255,122,0,0.35)",
        opacity: 1,
    },
} as const;

export const PremiumSwitch = ({ sx, ...props }: SwitchProps) => {
    return (
        <Switch
            {...props}
            sx={Array.isArray(sx) ? [premiumSwitchSx, ...sx] : [premiumSwitchSx, sx]}
        />
    );
};