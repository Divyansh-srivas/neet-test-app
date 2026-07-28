import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function Calculator({ onClose, position }) {
    const [display, setDisplay] = useState('0');
    const [equation, setEquation] = useState('');
    const [newNumber, setNewNumber] = useState(true);

    const handlePress = (val) => {
        if (val === 'C') {
            setDisplay('0');
            setEquation('');
            setNewNumber(true);
            return;
        }

        if (['+', '-', '*', '/'].includes(val)) {
            setEquation(display + ' ' + val + ' ');
            setNewNumber(true);
            return;
        }

        if (val === '=') {
            try {
                // Safe eval since input is strictly controlled
                // eslint-disable-next-line
                const result = eval(equation + display);
                setDisplay(String(result));
                setEquation('');
                setNewNumber(true);
            } catch (e) {
                setDisplay('Error');
                setNewNumber(true);
            }
            return;
        }

        if (newNumber) {
            setDisplay(val === '.' ? '0.' : val);
            setNewNumber(false);
        } else {
            if (val === '.' && display.includes('.')) return;
            setDisplay(display + val);
        }
    };

    return (
        <div style={{ 
            position: 'fixed', 
            bottom: 20, 
            left: position === 'Left' ? 320 : 20, 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: 12, 
            padding: 16, 
            zIndex: 90, 
            width: 220, 
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)' 
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Calculator</span>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            
            <div style={{ 
                background: 'var(--bg)', 
                padding: '6px 10px', 
                borderRadius: 8, 
                color: 'white', 
                textAlign: 'right', 
                marginBottom: 10, 
                fontFamily: 'monospace',
                overflow: 'hidden',
                whiteSpace: 'nowrap'
            }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', minHeight: 16, overflow: 'hidden' }}>{equation}</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{display}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {['7','8','9','/','4','5','6','*','1','2','3','-','C','0','.','+'].map(c => (
                    <button 
                        key={c} 
                        onClick={() => handlePress(c)}
                        style={{ 
                            background: ['/','*','-','+','C'].includes(c) ? 'var(--surface-hover)' : 'var(--surface2)', 
                            border: '1px solid var(--border)', 
                            borderRadius: 6, 
                            padding: '10px 0', 
                            color: ['/','*','-','+'].includes(c) ? 'var(--accent)' : c === 'C' ? 'var(--red)' : 'white', 
                            cursor: 'pointer', 
                            fontWeight: 700,
                            fontSize: 15,
                            transition: 'all 0.1s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.2)'}
                        onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {c}
                    </button>
                ))}
                <button 
                    onClick={() => handlePress('=')}
                    style={{ 
                        gridColumn: '1 / -1',
                        background: 'linear-gradient(135deg, var(--accent), var(--accent2))', 
                        border: 'none', 
                        borderRadius: 6, 
                        padding: '10px 0', 
                        color: 'white', 
                        cursor: 'pointer', 
                        fontWeight: 700,
                        fontSize: 16,
                        marginTop: 2
                    }}
                >
                    =
                </button>
            </div>
        </div>
    );
}
