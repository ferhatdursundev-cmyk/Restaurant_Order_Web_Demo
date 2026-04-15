import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Slide, { type SlideProps } from "@mui/material/Slide";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { close } from "../store/notify.slice";

function SlideDownTransition(props: SlideProps) {
    return <Slide {...props} direction="down" />;
}

export function GlobalNotify() {
    const dispatch = useAppDispatch();
    const { open, message, severity, autoHideMs, key } = useAppSelector((s) => s.notify);

    return (
        <Snackbar
            key={key}
            open={open}
            autoHideDuration={autoHideMs} // 3000ms
            onClose={(_, reason) => {
                if (reason === "clickaway") return;
                dispatch(close());
            }}
            anchorOrigin={{ vertical: "top", horizontal: "center" }} // yukarıdan
            TransitionComponent={SlideDownTransition} // düşer gibi
            sx={{
                mt: { xs: 1.5, sm: 2 }, // üstten biraz boşluk
                "& .MuiSnackbarContent-root": { borderRadius: 999 },
            }}
        >
            <Alert
                severity={severity}
                variant="filled"
                onClose={() => dispatch(close())}
                sx={{
                    borderRadius: 999,
                    fontWeight: 900,
                    alignItems: "center",
                    boxShadow: "0 18px 60px rgba(0,0,0,0.28)",
                }}
            >
                {message}
            </Alert>
        </Snackbar>
    );
}