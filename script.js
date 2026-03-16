/**
 * Setiba Flats - Main Application Logic
 */

// WARNING/IMPORTANT: The owner MUST replace these URLs with the actual Airbnb export iCal URLs.
// These are currently placeholder URLs for demonstration.
const ICAL_URLS = {
    liberdade: 'https://www.airbnb.com.br/calendar/ical/40783403.ics?t=3513b9dcf2ef45dcb1af5b457d60f7a0',
    sossego: 'https://www.airbnb.com.br/calendar/ical/40630644.ics?t=b9fb2454cf6045dbb41c1e246dbfd244',
    brisas: 'https://www.airbnb.com.br/calendar/ical/40983284.ics?t=db95a1ac49bd49b09055293e83937b36'
};

// Replace with the owner's WhatsApp number (country code + DDD + number, digits only)
const WHATSAPP_NUMBER = '5527992528762';

// Cache for parsed iCal data per flat
const calendarData = {
    liberdade: { events: [], loaded: false, error: false },
    sossego: { events: [], loaded: false, error: false },
    brisas: { events: [], loaded: false, error: false }
};

document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initSmoothScroll();
    initCurrentYear();
    initBookingSystem();
    initLightbox();
    initDetailsModal();

    // Set min date for date inputs to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('checkin').min = today;
    document.getElementById('checkout').min = today;
});

function initMobileMenu() {
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (mobileBtn && navLinks) {
        mobileBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');

            // Allow closing by clicking a link
            if (navLinks.classList.contains('active')) {
                navLinks.querySelectorAll('a').forEach(link => {
                    link.addEventListener('click', () => {
                        navLinks.classList.remove('active');
                    }, { once: true });
                });
            }
        });
    }

    // Header scroll effect
    const header = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.background = 'rgba(249, 246, 240, 0.98)';
            header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.05)';
        } else {
            header.style.background = 'rgba(249, 246, 240, 0.95)';
            header.style.boxShadow = 'none';
        }
    });
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                // Account for fixed header height
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

function initCurrentYear() {
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

// Minimal iCal parser for VEVENT DTSTART and DTEND
function parseICal(icsString) {
    const lines = icsString.split(/\r?\n/);
    const events = [];
    let currentEvent = null;

    for (let line of lines) {
        line = line.trim();
        if (line === 'BEGIN:VEVENT') {
            currentEvent = {};
        } else if (line === 'END:VEVENT') {
            if (currentEvent && currentEvent.start && currentEvent.end) {
                events.push(currentEvent);
            }
            currentEvent = null;
        } else if (currentEvent) {
            if (line.startsWith('DTSTART')) {
                const parts = line.split(':');
                if (parts.length > 1) currentEvent.start = parseICalDate(parts[1]);
            } else if (line.startsWith('DTEND')) {
                const parts = line.split(':');
                if (parts.length > 1) currentEvent.end = parseICalDate(parts[1]);
            }
        }
    }
    return events;
}

// Converts iCal date string (YYYYMMDD) to JS Date object
function parseICalDate(dateStr) {
    // Sometimes Airbnb dates include time or identifiers, take only the first 8 digits if possible
    const pureDate = dateStr.split('T')[0].replace(/[^0-9]/g, '');
    const year = parseInt(pureDate.substring(0, 4));
    const month = parseInt(pureDate.substring(4, 6)) - 1; // 0-indexed
    const day = parseInt(pureDate.substring(6, 8));
    return new Date(year, month, day);
}

// Check if requested date range overlaps with any booked events
function isAvailable(flatId, checkinDate, checkoutDate) {
    const data = calendarData[flatId];
    
    // If we haven't loaded yet or there was an error, we can't accurately say
    // However, to keep the flow, we will return 'null' to indicate 'unknown/error'
    if (!data.loaded) return 'loading';
    if (data.error) return 'error';

    const events = data.events;
    const checkin = new Date(checkinDate);
    const checkout = new Date(checkoutDate);

    for (const event of events) {
        // Conflict occurs if checkin is before event ends AND checkout is after event starts
        if (checkin < event.end && checkout > event.start) {
            return false;
        }
    }
    return true;
}

// Fetch iCal data using a CORS proxy.
async function fetchCalendar(flatId) {
    const originalUrl = ICAL_URLS[flatId];
    // Using a public CORS proxy to allow browser-side fetching
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(originalUrl)}`;
    
    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.text();
        calendarData[flatId].events = parseICal(data);
        calendarData[flatId].loaded = true;
        calendarData[flatId].error = false;
        console.log(`Successfully loaded calendar for ${flatId}`);
    } catch (error) {
        console.error(`Could not fetch iCal for ${flatId}:`, error);
        calendarData[flatId].loaded = true; // Mark as loaded even if error to stop spinner
        calendarData[flatId].error = true;
    }
}

function initBookingSystem() {
    const form = document.getElementById('booking-form');
    const flatSelect = document.getElementById('flat-select');
    const checkinInput = document.getElementById('checkin');
    const checkoutInput = document.getElementById('checkout');
    const statusBox = document.getElementById('availability-status');
    const checkBtn = document.getElementById('check-btn');
    const whatsappBtn = document.getElementById('whatsapp-btn');

    // Pre-fetch calendars when a flat is selected
    flatSelect.addEventListener('change', () => {
        const flatId = flatSelect.value;
        if (flatId && !calendarData[flatId].loaded) {
            fetchCalendar(flatId);
        }
        resetStatus();
    });

    // Auto-adjust checkout to be at least 1 day after checkin if needed
    checkinInput.addEventListener('change', () => {
        if (checkinInput.value) {
            const inDate = new Date(checkinInput.value);
            const nextDay = new Date(inDate);
            nextDay.setDate(nextDay.getDate() + 1);
            checkoutInput.min = nextDay.toISOString().split('T')[0];

            if (checkoutInput.value && new Date(checkoutInput.value) <= inDate) {
                checkoutInput.value = checkoutInput.min;
            }
        }
        resetStatus();
    });

    checkoutInput.addEventListener('change', resetStatus);

    function resetStatus() {
        statusBox.classList.add('hidden');
        statusBox.className = 'status-message hidden';
        statusBox.innerHTML = '';
        whatsappBtn.classList.add('hidden');
        checkBtn.classList.remove('hidden');
        checkBtn.disabled = false;
        checkBtn.innerHTML = '<i class="ph ph-magnifying-glass"></i> Consultar Datas';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const flatId = flatSelect.value;
        const checkin = checkinInput.value;
        const checkout = checkoutInput.value;
        const flatName = flatSelect.options[flatSelect.selectedIndex].text;

        if (!flatId || !checkin || !checkout) return;

        // Show loading state
        checkBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Consultando...';
        checkBtn.disabled = true;

        // Ensure calendar is loaded (or wait a bit if it was already triggered)
        if (!calendarData[flatId].loaded) {
            await fetchCalendar(flatId);
        }

        // Delay for UX
        setTimeout(() => {
            const availability = isAvailable(flatId, checkin, checkout);

            checkBtn.innerHTML = '<i class="ph ph-magnifying-glass"></i> Consultar Datas';
            checkBtn.disabled = false;

            statusBox.classList.remove('hidden');

            if (availability === true) {
                statusBox.classList.add('status-available');
                statusBox.innerHTML = '<i class="ph ph-check-circle"></i> Disponível! O flat está livre nestas datas.';

                // Configure WhatsApp Button
                const dateInArr = checkin.split('-');
                const dateOutArr = checkout.split('-');
                const strIn = `${dateInArr[2]}/${dateInArr[1]}/${dateInArr[0]}`;
                const strOut = `${dateOutArr[2]}/${dateOutArr[1]}/${dateOutArr[0]}`;

                const text = `Olá! Tenho interesse em reservar o ${flatName}.%0AAs datas que selecionei no site são de ${strIn} a ${strOut}.%0AGostaria de mais informações e confirmar a reserva.`;
                whatsappBtn.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;

                checkBtn.classList.add('hidden');
                whatsappBtn.classList.remove('hidden');
            } else if (availability === false) {
                statusBox.classList.add('status-unavailable');
                statusBox.innerHTML = '<i class="ph ph-x-circle"></i> Indisponível. Estas datas já estão ocupadas.';
                whatsappBtn.classList.add('hidden');
            } else if (availability === 'error') {
                statusBox.classList.add('status-unavailable'); // Using caution/unavailable style
                statusBox.innerHTML = '<i class="ph ph-warning"></i> Não foi possível verificar em tempo real agora. Entre em contato para confirmar.';
                
                // Still show WhatsApp button as fallback
                const text = `Olá! Gostaria de verificar a disponibilidade do ${flatName} de ${checkin} a ${checkout}. O site não conseguiu consultar automaticamente o calendário.`;
                whatsappBtn.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
                whatsappBtn.classList.remove('hidden');
                checkBtn.classList.add('hidden');
            }
        }, 800);
    });
}

function initLightbox() {
    const modal = document.getElementById('lightbox-modal');
    if (!modal) return;

    const overlay = document.querySelector('.lightbox-overlay');
    const closeBtn = document.querySelector('.lightbox-close');
    const prevBtn = document.querySelector('.lightbox-prev');
    const nextBtn = document.querySelector('.lightbox-next');
    const imgEl = document.getElementById('lightbox-img');
    const currentSpan = document.getElementById('lightbox-current');
    const totalSpan = document.getElementById('lightbox-total');

    let currentImages = [];
    let currentIndex = 0;

    // Exact filenames of the images available in each folder
    const galleryMap = {
        liberdade: [
            "1.jpg", "2.jpg", "3.JPG", "4.JPG", "5.JPG", "6.JPG", "7.JPG", "8.JPG", "9.jpg"
        ],
        sossego: [
            "1.JPG", "2.JPG", "3.JPG", "4.JPG", "5.JPG", "6.JPG", "7.JPG", "8.JPG", "9.JPG", "10.JPG", "11.JPG", "12.JPG"
        ],
        brisas: [
            "GPTempDownload 2.JPG", "GPTempDownload 3.JPG", "GPTempDownload 4.JPG", "GPTempDownload 5.JPG", "GPTempDownload 6.JPG", "GPTempDownload 11.JPG"
        ],
        casa: [
            "../frentecasa.png" // Relative to the gallery path logic or I'll fix the logic below
        ]
    };

    document.querySelectorAll('.btn-gallery').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const flatId = btn.getAttribute('data-flat');

            if (!galleryMap[flatId]) {
                console.warn(`No gallery found for flatId: ${flatId}`);
                return;
            }

            // Build image array specific to the selected flat
            currentImages = galleryMap[flatId].map(filename => {
                if (filename.startsWith('..')) {
                    // Special case for images at the root of /img/
                    return `img/${filename.replace('../', '')}`;
                }
                return `img/${flatId}/galeria/${filename}`;
            });

            currentIndex = 0;
            updateLightbox();
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        });
    });

    function updateLightbox() {
        imgEl.src = currentImages[currentIndex];
        currentSpan.textContent = currentIndex + 1;
        totalSpan.textContent = currentImages.length;
    }

    function closeLightbox() {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    closeBtn.addEventListener('click', closeLightbox);
    overlay.addEventListener('click', closeLightbox);

    prevBtn.addEventListener('click', () => {
        currentIndex = (currentIndex > 0) ? currentIndex - 1 : currentImages.length - 1;
        updateLightbox();
    });

    nextBtn.addEventListener('click', () => {
        currentIndex = (currentIndex < currentImages.length - 1) ? currentIndex + 1 : 0;
        updateLightbox();
    });

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (modal.classList.contains('hidden')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') prevBtn.click();
        if (e.key === 'ArrowRight') nextBtn.click();
    });
}

const flatDetails = {
    liberdade: {
        title: "Flat Liberdade - Detalhes",
        desc: "Possui um dormitório com ar-condicionado split, com uma cama de casal e uma de solteiro. Um banheiro. Uma sala com televisão e uma cozinha/sala integrada.",
        amenities: [
            { icon: "ph-wind", text: "Ar-condicionado Split" },
            { icon: "ph-bed", text: "1 Cama de Casal e 1 de Solteiro" },
            { icon: "ph-shower", text: "Banheiro Privativo" },
            { icon: "ph-television", text: "Televisão" },
            { icon: "ph-cooking-pot", text: "Cozinha Completa" },
            { icon: "ph-fire", text: "Fogão a gás com forno" },
            { icon: "ph-coffee", text: "Mesa de jantar para 4 pessoas" },
            { icon: "ph-fork-knife", text: "Pratos, copos, taças e talheres" },
            { icon: "ph-blender", text: "Air Fryer e Liquidificador" }
        ]
    },
    sossego: {
        title: "Flat Sossego - Detalhes",
        desc: "Possui um dormitório tipo suíte com cama de casal e uma de solteiro (com ar-condicionado e TV), e um segundo dormitório com duas camas de solteiro e ventilador de teto.",
        amenities: [
            { icon: "ph-wind", text: "Ar-condicionado e Ventilador" },
            { icon: "ph-bed", text: "1 Casal e 3 Solteiro (Total)" },
            { icon: "ph-television", text: "TV na Suíte" },
            { icon: "ph-shower", text: "Suíte com Banheiro Individual" },
            { icon: "ph-cooking-pot", text: "Cozinha Completa com Geladeira" },
            { icon: "ph-fire", text: "Fogão a gás" },
            { icon: "ph-coffee", text: "Mesa de jantar para 5 pessoas" },
            { icon: "ph-blender", text: "Microondas, Air Fryer e Liquidificador" },
            { icon: "ph-fork-knife", text: "Talheres, copos, taças e panelas" }
        ]
    },
    brisas: {
        title: "Flat Brisas - Detalhes",
        desc: "Possui um dormitório com uma cama de casal e uma de solteiro (ar-condicionado split) e um segundo dormitório com uma cama de casal e uma de solteiro (ventilador de teto).",
        amenities: [
            { icon: "ph-wind", text: "Ar-condicionado e Ventilador" },
            { icon: "ph-bed", text: "2 de Casal e 2 de Solteiro (Total)" },
            { icon: "ph-television", text: "TV" },
            { icon: "ph-coffee", text: "Mesa de jantar com 6 cadeiras" },
            { icon: "ph-cooking-pot", text: "Cozinha Integrada" },
            { icon: "ph-fire", text: "Fogão a gás" },
            { icon: "ph-blender", text: "Microondas, Air Fryer e Liquidificador" },
            { icon: "ph-fork-knife", text: "Pratos, copos, taças e panelas" }
        ]
    }
};

function initDetailsModal() {
    const modal = document.getElementById('details-modal');
    if (!modal) return;

    const overlay = modal.querySelector('.details-overlay');
    const closeBtn = modal.querySelector('.details-close');
    const titleEl = document.getElementById('details-title');
    const descEl = document.getElementById('details-desc');
    const amenitiesEl = document.getElementById('details-amenities');

    document.querySelectorAll('.btn-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const flatId = btn.getAttribute('data-flat');
            const data = flatDetails[flatId];

            if (!data) return;

            titleEl.textContent = data.title;
            descEl.textContent = data.desc;

            // Populate amenities
            amenitiesEl.innerHTML = '';
            data.amenities.forEach(item => {
                const div = document.createElement('div');
                div.className = 'amenity-item';
                div.innerHTML = `<i class="ph ${item.icon}"></i> <span>${item.text}</span>`;
                amenitiesEl.appendChild(div);
            });

            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        });
    });

    function closeModal() {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('hidden') && e.key === 'Escape') {
            closeModal();
        }
    });
}
