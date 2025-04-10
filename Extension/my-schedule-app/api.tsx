const sendToFlask = async (text: string) => {
    try {
      const res = await fetch("http://localhost:5000/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
  
      const data = await res.json();
      return data.summary || "No summary available.";
    } catch (err) {
      console.error("Error:", err);
      return "Failed to parse.";
    }
  };
  