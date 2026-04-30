import { TextField, type TextFieldProps } from "@mui/material";

type DarkTextFieldProps = TextFieldProps & {
    hasError?: boolean;
};

export function DarkTextField({ hasError, sx, ...props }: DarkTextFieldProps) {
    return (
        <TextField
            fullWidth
            size="small"
            error={hasError}
            sx={{
                mb: 1.5,
                "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.75)" },
                "& .MuiFormHelperText-root": {
                    color: hasError ? "#ffb4b4" : "rgba(255,255,255,0.65)",
                    mx: 0.5,
                },
                "& .MuiOutlinedInput-root": {
                    borderRadius: 2.5,
                    color: "white",
                    bgcolor: "rgba(255,255,255,0.04)",
                    "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: hasError
                            ? "rgba(255,120,120,0.9)"
                            : "rgba(255,255,255,0.18)",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: hasError
                            ? "rgba(255,120,120,1)"
                            : "rgba(255,255,255,0.30)",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: hasError
                            ? "rgba(255,120,120,1)"
                            : "rgba(255,255,255,0.55)",
                    },
                },
                ...sx,
            }}
            {...props}
        />
    );
}