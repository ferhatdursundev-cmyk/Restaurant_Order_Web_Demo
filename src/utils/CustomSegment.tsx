import { Tabs, Tab } from "@mui/material";

type Item = {
    key: string;
    label: string;
};

type Props = {
    value: string;
    onChange: (key: string) => void;
    items: Item[];
};

export const CustomSegment = ({ value, onChange, items }: Props) => {
    return (
        <Tabs
            value={value}
            onChange={(_, newValue) => onChange(newValue)}
            variant="scrollable"
            scrollButtons={false}
            allowScrollButtonsMobile
            sx={{
                width: "100%",
                minHeight: 28,
                "& .MuiTabs-indicator": { display: "none" },

                "& .MuiTabs-scroller": {
                    width: "100%",
                    "&::-webkit-scrollbar": { display: "none" },
                    scrollbarWidth: "none",
                },

                "& .MuiTabs-flexContainer": {
                    width: "max-content",
                    justifyContent: "flex-start", // Butonları sola yaslar
                },

                "& .MuiTab-root": {
                    textTransform: "none",
                    minHeight: 26,
                    height: 26,
                    minWidth: "auto",
                    px: 1.1,
                    py: 0,
                    fontSize: 11.5,
                    fontWeight: 750,
                    borderRadius: 999,
                    border: "1px solid",
                    borderColor: "divider",
                    mr: 0.6,
                    transition: "all 120ms ease",
                },

                "& .MuiTab-root:hover": {
                    bgcolor: "action.hover",
                },

                "& .MuiTab-root.Mui-selected": {
                    bgcolor: "#FF7A00",
                    color: "#fff",
                    borderColor: "#FF7A00",
                    boxShadow: "0 6px 18px rgba(255,122,0,0.35)",
                },
            }}
        >
            {items.map((item) => (
                <Tab key={item.key} value={item.key} label={item.label} disableRipple />
            ))}
        </Tabs>
    );
}