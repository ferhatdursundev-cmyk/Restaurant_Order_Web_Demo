import { useState, useMemo, useCallback } from "react";

export type PaymentMethod = "cash" | "card";

export const useBasketForm = () => {
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerFirstName, setCustomerFirstName] = useState("");
    const [customerLastName, setCustomerLastName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

    const isValidEmail = useMemo(
        () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim()),
        [customerEmail]
    );

    const isValidFirstName = useMemo(
        () => customerFirstName.trim().length >= 2,
        [customerFirstName]
    );

    const isValidLastName = useMemo(
        () => customerLastName.trim().length >= 2,
        [customerLastName]
    );

    const isValidPhone = useMemo(
        () => /^[0-9+\s-]{7,15}$/.test(customerPhone.trim()),
        [customerPhone]
    );

    const handleEmailChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => setCustomerEmail(e.target.value),
        []
    );

    const handleFirstNameChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => setCustomerFirstName(e.target.value),
        []
    );

    const handleLastNameChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => setCustomerLastName(e.target.value),
        []
    );

    const handlePhoneChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => setCustomerPhone(e.target.value),
        []
    );

    const handlePaymentMethodChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            setPaymentMethod(e.target.value as PaymentMethod),
        []
    );

    return {
        customerEmail,
        customerFirstName,
        customerLastName,
        customerPhone,
        paymentMethod,
        isValidEmail,
        isValidFirstName,
        isValidLastName,
        isValidPhone,
        handleEmailChange,
        handleFirstNameChange,
        handleLastNameChange,
        handlePhoneChange,
        handlePaymentMethodChange,
    };
}