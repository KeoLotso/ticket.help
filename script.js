const SUPABASE_URL = 'https://apqeitnavsjwqrpruuqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwcWVpdG5hdnNqd3FycHJ1dXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMDUzMzYsImV4cCI6MjA1OTY4MTMzNn0.G14iwTdC2qpCsRTw3-JcKTowx4yRWJPpObGGWIr65lQ';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ticketForm = document.getElementById('ticketForm');
const ticketsList = document.getElementById('ticketsList');
const messageDiv = document.getElementById('message');

function showMessage(text, type) {
    messageDiv.innerHTML = `<div class="${type}">${text}</div>`;
    setTimeout(() => {
        messageDiv.innerHTML = '';
    }, 5000);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getImportanceClass(importance) {
    switch(importance) {
        case 'Nicht Wichtig':
            return 'importance-low';
        case 'Mittel':
            return 'importance-medium';
        case 'Extrem Wichtig':
            return 'importance-high';
        default:
            return 'importance-medium';
    }
}

async function loadTickets() {
    try {
        ticketsList.innerHTML = '<div class="loading">Lade Tickets...</div>';
        
        const { data: files, error } = await supabase.storage
            .from('tickets')
            .list();
        
        if (error) {
            console.error('Error listing files:', error);
            throw error;
        }
        
        if (!files || files.length === 0) {
            ticketsList.innerHTML = '<div class="card">Keine Tickets vorhanden.</div>';
            return;
        }
        
        console.log('Found files:', files);
        
        files.sort((a, b) => b.name.localeCompare(a.name));
        
        const ticketPromises = files.map(async (file) => {
            try {
                const { data, error: downloadError } = await supabase.storage
                    .from('tickets')
                    .download(file.name);
                    
                if (downloadError) {
                    console.error(`Error downloading file ${file.name}:`, downloadError);
                    return null;
                }
                
                const text = await data.text();
                try {
                    const ticket = JSON.parse(text);
                    return { ...ticket, id: file.name };
                } catch (e) {
                    console.error(`Error parsing ticket ${file.name}:`, e);
                    return null;
                }
            } catch (err) {
                console.error(`Error processing file ${file.name}:`, err);
                return null;
            }
        });
        
        const tickets = await Promise.all(ticketPromises);
        
        const validTickets = tickets.filter(t => t !== null);
        
        if (validTickets.length === 0) {
            ticketsList.innerHTML = '<div class="card">Keine Tickets vorhanden oder Fehler beim Laden.</div>';
            return;
        }
        
        validTickets.sort((a, b) => {
            if (a.Date && b.Date) {
                return new Date(b.Date) - new Date(a.Date);
            }
            return 0;
        });
        
        ticketsList.innerHTML = validTickets.map(ticket => `
            <div class="ticket">
                <div class="ticket-header">
                    <div>
                        <div class="ticket-username">${ticket.Username || 'Unbekannt'}</div>
                        <div class="ticket-id">${ticket.id}</div>
                    </div>
                    <div class="ticket-date">${ticket.Date ? formatDate(ticket.Date) : 'Kein Datum'}</div>
                </div>
                <div class="ticket-content">${ticket.Problem || 'Keine Beschreibung'}</div>
                <div class="importance ${getImportanceClass(ticket.Importancy)}">${ticket.Importancy || 'Unbekannt'}</div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading tickets:', error);
        ticketsList.innerHTML = '<div class="error">Fehler beim Laden der Tickets: ' + error.message + '</div>';
    }
}

async function createTicket(username, problem, importance) {
    try {

        const { data: files, error: listError } = await supabase.storage
            .from('tickets')
            .list();
            
        if (listError) {
            console.error('Error listing files:', listError);
            throw listError;
        }
        
        const ticketCount = files ? files.length + 1 : 1;
        const ticketId = `Ticket.${String(ticketCount).padStart(3, '0')}`;
        
        const ticketData = {
            Username: username,
            Problem: problem,
            Importancy: importance,
            Date: new Date().toISOString()
        };
        
        console.log('Creating ticket:', ticketId, ticketData);
        
        const jsonData = JSON.stringify(ticketData);
        const blob = new Blob([jsonData], { type: 'application/json' });
        
        const { error: uploadError } = await supabase.storage
            .from('tickets')
            .upload(ticketId, blob);
            
        if (uploadError) {
            console.error('Error uploading ticket:', uploadError);
            throw uploadError;
        }
        
        showMessage('Ticket erfolgreich erstellt!', 'success');
        loadTickets();
        return true;
        
    } catch (error) {
        console.error('Error creating ticket:', error);
        showMessage('Fehler beim Erstellen des Tickets: ' + error.message, 'error');
        return false;
    }
}

ticketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const problem = document.getElementById('problem').value.trim();
    const importance = document.getElementById('importance').value;
    
    if (!username || !problem) {
        showMessage('Bitte füllen Sie alle Pflichtfelder aus.', 'error');
        return;
    }
    
    const success = await createTicket(username, problem, importance);
    
    if (success) {
        document.getElementById('username').value = '';
        document.getElementById('problem').value = '';
        document.getElementById('importance').value = 'Nicht Wichtig';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, initializing Supabase and loading tickets...');
    loadTickets();
});
