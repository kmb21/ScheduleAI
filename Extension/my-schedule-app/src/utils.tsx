export interface EventItem {
    event: string;
    raw_subject: string;
    time: {
      iso: string;
      display: string;
    };
    context: string;
    sender: string;
    urgency: string;
    gmailThread?: string;
  }


export const TodayIcon: React.FC = () => {
  const day = new Date().getDate();           // 1-31
  return (
    <span style={{
      display: 'inline-block',
      width: 24, height: 24,
      position: 'relative',
      fontSize: 12,
      fontWeight: 700,
      lineHeight: '24px',
      textAlign: 'center',
      background: '#e0e0e0',
      borderRadius: 4,
    }}>
      {day}
      {/* little calendar “ring” */}
      <span style={{
        position: 'absolute',
        top: -4,
        left: 4,
        width: 16, height: 4,
        background: '#4285F4',
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4
      }} />
    </span>
  );
};


export const freeTextToGcal = (e: {event: string, time: any, context?: string, participants?: string[];}) => {
  const title   = encodeURIComponent(e.event);
  const details = encodeURIComponent(e.context ?? '');
  const location = encodeURIComponent('');
  const guests = e.participants 

  let start: string = '';
  let end: string | null = null;

  if (e.time?.iso && e.time.iso.includes('/')) {
    const [startStr, endStr] = e.time.iso.split('/');
    start = startStr.replace(/[-:.]/g, '').slice(0, 15);
    end = endStr.replace(/[-:.]/g, '').slice(0, 15);
  } else if (e.time?.iso && e.time.iso.length >= 16) {
    start = e.time.iso.replace(/[-:.]/g, '').slice(0, 15);
    end = new Date(new Date(e.time.iso).getTime() + 60 * 60 * 1000)
             .toISOString().replace(/[-:.]/g, '').slice(0, 15);
  } else if (e.time?.iso) {
    start = e.time.iso.replace(/-/g, '');
    end = null;
  } else {
    const now = new Date();
    start = now.toISOString().replace(/[-:.]/g, '').slice(0, 15);
    end = new Date(now.getTime() + 60 * 60 * 1000)
             .toISOString().replace(/[-:.]/g, '').slice(0, 15);
  }

  const dateParam = end ? `${start}/${end}` : start;

  window.open(
    `https://calendar.google.com/calendar/r/eventedit?text=${title}` +
    `&details=${details}&location=${location}&dates=${dateParam}` +
    (guests ? `&add=${guests}` : ''),
    '_blank'
  );
};
