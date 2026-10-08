import { qs, qsa } from './util.js';

/**
 * Reservation form.
 *
 * Validation runs in the browser for speed, but the markup also carries the
 * native `required`, `type` and `min` attributes, so a visitor with
 * JavaScript off still gets the browser's own validation. Nothing here is the
 * only line of defence - whatever endpoint this posts to has to validate
 * again on the server.
 *
 * There is no backend wired up in this build. `submit` is intercepted, the
 * payload is assembled and logged, and the confirmation panel is shown. Point
 * ENDPOINT at a real URL (a form service, or your own handler) to go live.
 */

const ENDPOINT = ''; // e.g. 'https://formspree.io/f/xxxxxxx' or '/api/reservations'

const MESSAGES = {
  valueMissing: 'This one is required.',
  typeMismatch: 'That does not look quite right.',
  tooShort: 'A little more detail, please.',
  rangeUnderflow: 'Please choose a date from today onwards.',
  default: 'Please check this field.',
};

function messageFor(input) {
  const v = input.validity;
  if (v.valueMissing) return MESSAGES.valueMissing;
  if (v.typeMismatch) return MESSAGES.typeMismatch;
  if (v.tooShort) return MESSAGES.tooShort;
  if (v.rangeUnderflow) return MESSAGES.rangeUnderflow;
  return MESSAGES.default;
}

function setFieldState(input, valid) {
  const field = input.closest('.field');
  if (!field) return;
  field.classList.toggle('is-invalid', !valid);
  input.setAttribute('aria-invalid', valid ? 'false' : 'true');
  const error = qs('.field__error', field);
  if (error) error.textContent = valid ? '' : messageFor(input);
}

export function initReservationForm() {
  const form = qs('[data-reservation]');
  if (!form) return;

  const success = qs('[data-reservation-success]', form.parentElement || document);
  const status = qs('[data-reservation-status]', form);
  const submit = qs('[type="submit"]', form);
  const inputs = qsa('input, select, textarea', form).filter((el) => el.type !== 'hidden');

  // Stop anyone booking a table in the past.
  const dateInput = qs('input[type="date"]', form);
  if (dateInput && !dateInput.min) {
    dateInput.min = new Date().toISOString().split('T')[0];
  }

  // Validate on blur, then live once a field has already been flagged. Showing
  // an error while someone is still typing their first character is hostile.
  inputs.forEach((input) => {
    input.addEventListener('blur', () => setFieldState(input, input.checkValidity()));
    input.addEventListener('input', () => {
      if (input.closest('.field')?.classList.contains('is-invalid')) {
        setFieldState(input, input.checkValidity());
      }
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Honeypot. A human never sees this field, so anything in it is a bot.
    // Pretend everything went fine rather than telling the script it failed.
    const trap = qs('[name="company"]', form);
    if (trap && trap.value.trim() !== '') {
      form.hidden = true;
      if (success) success.hidden = false;
      return;
    }

    const invalid = inputs.filter((input) => !input.checkValidity());
    inputs.forEach((input) => setFieldState(input, input.checkValidity()));

    if (invalid.length) {
      invalid[0].focus();
      if (status) {
        status.hidden = false;
        status.textContent = `${invalid.length} field${invalid.length > 1 ? 's need' : ' needs'} attention.`;
      }
      return;
    }

    if (status) {
      status.hidden = false;
      status.textContent = 'Sending…';
    }
    if (submit) submit.disabled = true;

    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      if (ENDPOINT) {
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form),
        });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      } else {
        // demo mode - no endpoint configured yet
        console.info('Reservation request (no endpoint configured):', payload);
        await new Promise((resolve) => setTimeout(resolve, 450));
      }

      form.hidden = true;
      if (success) {
        success.hidden = false;
        success.setAttribute('tabindex', '-1');
        success.focus();
      }
    } catch (error) {
      console.error(error);
      if (status) {
        status.hidden = false;
        status.textContent = 'Something went wrong. Please call us instead.';
      }
      if (submit) submit.disabled = false;
    }
  });
}
