
// LIVE VIVA CONSOLE (SIMULATOR)
const LiveVivaConsole = ({ batch, student, onClose }) => {
    const [stream, setStream] = useState(null);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [marks, setMarks] = useState({});
    const [remarks, setRemarks] = useState('');
    const videoRef = useRef(null);

    // Load QP (Viva or Practical)
    const allQPs = window.Utils.getQuestionPapers();
    // Prioritize Viva Paper, then Practical
    const qpId = batch.vivaPaperId || batch.practicalPaperId;
    const qp = allQPs.find(q => q.id === qpId);
    const questions = qp?.questions || [];

    useEffect(() => {
        // Start Camera
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(s => {
                setStream(s);
                if (videoRef.current) videoRef.current.srcObject = s;
            })
            .catch(err => alert("Camera Error: " + err.message));

        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, []);

    useEffect(() => {
        if (videoRef.current && stream) videoRef.current.srcObject = stream;
    }, [stream, videoRef.current]);

    const toggleVideo = () => {
        if (stream) {
            stream.getVideoTracks().forEach(t => t.enabled = !videoEnabled);
            setVideoEnabled(!videoEnabled);
        }
    };

    const toggleAudio = () => {
        if (stream) {
            stream.getAudioTracks().forEach(t => t.enabled = !audioEnabled);
            setAudioEnabled(!audioEnabled);
        }
    };

    const handleSave = () => {
        // Save marks to responses
        const response = {
            id: window.Utils.generateId(),
            studentId: student.id,
            batchId: batch.id,
            examType: 'VIVA',
            answers: {}, // Viva usually oral, no written answers stored here, maybe recordings
            assessorMarks: marks,
            assessorRemarks: remarks,
            totalScore: Object.values(marks).reduce((a, b) => a + parseFloat(b || 0), 0),
            submittedAt: new Date().toISOString()
        };
        window.Utils.saveResponse(response);
        alert("Viva Completed & Marks Saved!");
        onClose();
    };

    if (!qp) return <div className="p-8 text-white bg-gray-900 h-screen">No Viva/Practical Question Paper Assigned to Batch. <button onClick={onClose} className="text-blue-400">Close</button></div>;

    return (
        <div className="fixed inset-0 bg-gray-900 z-50 flex text-white font-sans">
            {/* Left: Video Feed */}
            <div className="w-3/5 relative bg-black flex items-center justify-center">
                <video ref={videoRef} autoPlay muted className="w-full h-full object-cover transform scale-x-[-1]" /> {/* Mirror effect */}

                <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> Live Consumer: {student.name}
                </div>

                {/* Controls */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-4">
                    <button onClick={toggleAudio} className={`p-4 rounded-full ${audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'} transition-all`}>
                        {audioEnabled ? <Icons.Microphone className="w-6 h-6" /> : <Icons.MicrophoneOff className="w-6 h-6" />}
                    </button>
                    <button onClick={toggleVideo} className={`p-4 rounded-full ${videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'} transition-all`}>
                        {videoEnabled ? <Icons.Video className="w-6 h-6" /> : <Icons.VideoOff className="w-6 h-6" />}
                    </button>
                    <button onClick={onClose} className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all text-white font-bold px-8">
                        End Call
                    </button>
                </div>
            </div>

            {/* Right: Grading Panel */}
            <div className="w-2/5 bg-white text-gray-800 flex flex-col h-full border-l border-gray-700">
                <div className="p-6 bg-indigo-600 text-white shadow-md">
                    <h2 className="text-xl font-bold flex items-center gap-2"><Icons.Cpu className="w-5 h-5" /> Viva Grading</h2>
                    <p className="text-indigo-200 text-sm">QP: {qp.qpName}</p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    {questions.map((q, idx) => (
                        <div key={q.id} className={`mb-6 p-4 rounded-lg border ${currentQIdx === idx ? 'border-indigo-500 bg-indigo-50 shadow-md ring-1 ring-indigo-200' : 'border-gray-200'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Question {idx + 1}</span>
                                <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded">Max: {q.totalMarks}</span>
                            </div>
                            <p className="font-bold text-lg mb-4 text-gray-800 leading-snug">{q.question}</p>

                            {/* Scenario Text if any (Usually part of question, but we can highlight) */}

                            <div className="flex items-center gap-3">
                                <label className="text-sm font-bold text-gray-700">Marks:</label>
                                <input
                                    type="number"
                                    max={q.totalMarks}
                                    min="0"
                                    className="w-24 p-2 border-2 border-gray-300 rounded-lg text-center font-bold text-lg focus:border-indigo-500 focus:outline-none transition-colors"
                                    value={marks[idx] || ''}
                                    onChange={e => {
                                        const val = Math.min(parseFloat(e.target.value) || 0, q.totalMarks);
                                        setMarks({ ...marks, [idx]: val });
                                    }}
                                    onFocus={() => setCurrentQIdx(idx)}
                                />
                            </div>
                        </div>
                    ))}

                    <hr className="my-6 border-gray-200" />

                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Overall Remarks</label>
                        <textarea
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                            rows="3"
                            placeholder="Enter detailed feedback for the student..."
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                        ></textarea>
                    </div>
                </div>

                <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
                    <div className="text-sm">
                        <span className="text-gray-500">Total Score:</span>
                        <strong className="text-2xl ml-2 text-indigo-700">{Object.values(marks).reduce((a, b) => a + parseFloat(b || 0), 0)}</strong>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="text-gray-500 font-bold">{qp.totalMarks}</span>
                    </div>
                    <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg transform hover:-translate-y-1 transition-all flex items-center gap-2">
                        <Icons.Save className="w-5 h-5" /> Submit Evaluation
                    </button>
                </div>
            </div>
        </div>
    );
};
