import * as React from "react";
import { MenuItem, TextField } from "@mui/material";

export type SelectItem<T extends string> = {
    value: T;
    label: React.ReactNode;
    disabled?: boolean;
};

export type DropdownProps<T extends string> = {
    label: string;
    value: T;
    onChange: (value: T) => void;
    items: ReadonlyArray<SelectItem<T>>;

    helperText?: React.ReactNode;
    fullWidth?: boolean;
    disabled?: boolean;
    required?: boolean;
    size?: "small" | "medium";
    variant?: "outlined" | "filled" | "standard";
    error?: boolean;
    name?: string;
    id?: string;
};

export function Dropdown<T extends string>({
                                                label,
                                                value,
                                                onChange,
                                                items,
                                                helperText,
                                                fullWidth = true,
                                                disabled = false,
                                                required = false,
                                                size = "medium",
                                                variant = "outlined",
                                                error = false,
                                                name,
                                                id,
                                            }: DropdownProps<T>) {
    return (
        <TextField
            id={id}
            name={name}
            select
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value as T)}
            fullWidth={fullWidth}
            helperText={helperText}
            disabled={disabled}
            required={required}
            size={size}
            variant={variant}
            error={error}
        >
            {items.map((it) => (
                <MenuItem key={it.value} value={it.value} disabled={it.disabled}>
                    {it.label}
                </MenuItem>
            ))}
        </TextField>
    );
}