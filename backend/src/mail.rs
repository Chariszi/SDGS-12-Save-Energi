use lettre::{
    message::Mailbox, transport::smtp::authentication::Credentials, Message, SmtpTransport,
    Transport,
};

/// Builds the clickable verification link that the register/login flows email.
pub fn verification_url(token: &str) -> String {
    let base =
        std::env::var("PUBLIC_BASE_URL").unwrap_or_else(|_| "http://127.0.0.1:8080".to_string());
    format!(
        "{}/api/auth/verify?token={token}",
        base.trim_end_matches('/')
    )
}

/// Sends the verification mail on a blocking worker thread. Without
/// SMTP_PASSWORD the link is printed to stderr instead, so local demos and
/// tests work without an inbox (never enable that fallback in production).
pub async fn send_verification(email: String, display_name: String, link: String) {
    let result =
        tokio::task::spawn_blocking(move || send_blocking(&email, &display_name, &link)).await;
    match result {
        Ok(Ok(())) => {}
        Ok(Err(message)) => eprintln!("verification email failed: {message}"),
        Err(_) => eprintln!("verification email task panicked"),
    }
}

fn send_blocking(email: &str, display_name: &str, link: &str) -> Result<(), String> {
    let username = std::env::var("SMTP_USERNAME").ok();
    let password = std::env::var("SMTP_PASSWORD").ok();
    let from = std::env::var("SMTP_FROM").ok().or_else(|| username.clone());

    let (Some(username), Some(password), Some(from)) = (username, password, from) else {
        eprintln!("SMTP not configured; verification link for {email}: {link}");
        return Ok(());
    };

    // Google shows app passwords as "xxxx xxxx xxxx xxxx"; the spaces are
    // display-only, so strip all whitespace before authenticating.
    let password: String = password.split_whitespace().collect();
    let host = std::env::var("SMTP_HOST").unwrap_or_else(|_| "smtp.gmail.com".to_string());
    let port: u16 = std::env::var("SMTP_PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(587);

    let mailbox: Mailbox = format!("SaveEnergi <{from}>")
        .parse()
        .map_err(|error| format!("invalid SMTP_FROM: {error}"))?;
    let to = email
        .parse::<Mailbox>()
        .map_err(|error| format!("invalid recipient: {error}"))?;

    let body = format!(
        "Halo {display_name},\n\n\
         Terima kasih sudah mendaftar di SaveEnergi (SDG 12).\n\
         Klik tautan berikut untuk memverifikasi email kamu:\n\n\
         {link}\n\n\
         Tautan berlaku 24 jam. Abaikan email ini jika kamu tidak mendaftar.\n"
    );
    let message = Message::builder()
        .from(mailbox)
        .to(to)
        .subject("Verifikasi email SaveEnergi")
        .body(body)
        .map_err(|error| format!("cannot build message: {error}"))?;

    let mailer = SmtpTransport::starttls_relay(&host)
        .map_err(|error| format!("cannot reach SMTP host: {error}"))?
        .port(port)
        .credentials(Credentials::new(username, password))
        .build();
    mailer.send(&message).map_err(|error| format!("{error}"))?;
    Ok(())
}
